import os
import asyncio
import requests
from datetime import datetime
from twilio.rest import Client
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import SessionLocal
from app.models.campaign import Campaign, CampaignCall
from app.models.farmer import Farmer

def get_twilio_client():
    from dotenv import load_dotenv
    load_dotenv(override=True)
    twilio_sid = os.getenv("TWILIO_ACCOUNT_SID")
    twilio_token = os.getenv("TWILIO_AUTH_TOKEN")
    if twilio_sid and twilio_token:
        return Client(twilio_sid, twilio_token)
    return None

async def run_campaign_async(campaign_id: int):
    # Reload environment to pick up updated .env credentials
    from dotenv import load_dotenv
    load_dotenv(override=True)
    local_client = get_twilio_client()

    db = SessionLocal()
    try:
        campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
        if not campaign or campaign.status == "Running":
            return
        
        campaign.status = "Running"
        db.commit()
        
        # Get selected farmers
        farmers = campaign.farmers
        base_url = (os.getenv("NGROK_URL") or "http://localhost:8000").strip()
        twiml_url = f"{base_url}/voice-calls/twiml"
        status_callback_url = f"{base_url}/voice-calls/twilio-status"
        twilio_number = os.getenv("TWILIO_PHONE_NUMBER")
        
        if not farmers:
            campaign.status = "Completed"
            db.commit()
            return

        for farmer in farmers:
            # Create CampaignCall entry if it doesn't exist yet
            campaign_call = db.query(CampaignCall).filter(
                CampaignCall.campaign_id == campaign.id,
                CampaignCall.farmer_id == farmer.id
            ).first()
            
            if not campaign_call:
                campaign_call = CampaignCall(
                    campaign_id=campaign.id,
                    farmer_id=farmer.id,
                    call_status="Initiated"
                )
                db.add(campaign_call)
                db.commit()
                db.refresh(campaign_call)
            
            try:
                recipient_phone = farmer.phone.replace(" ", "").replace("-", "")
                if not recipient_phone.startswith("+"):
                    recipient_phone = f"+{recipient_phone}"

                # Check if WhatsApp or Voice Campaign
                if campaign.campaign_type == "WhatsApp Campaign":
                    # WHATSAPP CAMPAIGN LOGIC
                    twilio_number = os.getenv("TWILIO_WHATSAPP_NUMBER")
                    if not twilio_number or not local_client:
                        print(f"Twilio / WhatsApp number not configured for Campaign {campaign_id}")
                        campaign_call.call_status = "failed"
                        campaign_call.summary = "Twilio credentials or WhatsApp number missing."
                        db.commit()
                        continue
                    
                    try:
                        twilio_response = local_client.messages.create(
                            from_=f"whatsapp:{twilio_number}",
                            body=campaign.description or "Hello from Biofactor!",
                            to=f"whatsapp:{recipient_phone}"
                        )
                        campaign_call.twilio_call_sid = twilio_response.sid
                        campaign_call.call_status = "completed"
                        campaign_call.summary = f"WhatsApp sent: {campaign.description[:100]}..."
                        campaign_call.transcript = f"System: Sent WhatsApp message: {campaign.description}"
                    except Exception as wa_err:
                        print(f"WhatsApp send failed: {wa_err}")
                        campaign_call.call_status = "failed"
                        campaign_call.summary = f"WhatsApp failed: {str(wa_err)}"
                    db.commit()

                else:
                    # VOICE CAMPAIGN LOGIC
                    # Check if we should use Vobiz or Twilio
                    vobiz_auth_id = os.getenv("VOBIZ_AUTH_ID", "").strip()
                    vobiz_auth_secret = os.getenv("VOBIZ_AUTH_SECRET", "").strip()
                    vobiz_app_id = os.getenv("VOBIZ_APP_ID", "").strip()

                    if vobiz_auth_id and vobiz_auth_secret and vobiz_app_id:
                        # VOBIZ CALL LOGIC
                        # Base URL: api.vobiz.ai/api/v1 (NOT api.vobiz.com)
                        # Auth: X-Auth-ID / X-Auth-Token headers (NOT Basic Auth)
                        vobiz_from = os.getenv("VOBIZ_PHONE_NUMBER", "").strip()
                        if vobiz_from.startswith("+"):
                            vobiz_from = vobiz_from[1:]

                        url = f"https://api.vobiz.ai/api/v1/Account/{vobiz_auth_id}/Call/"
                        payload = {
                            "from": vobiz_from,
                            "to": recipient_phone,
                            "answer_url": f"{base_url}/voice-calls/vobiz-xml",
                            "answer_method": "POST",
                            "app_id": vobiz_app_id
                        }
                        headers = {
                            "X-Auth-ID": vobiz_auth_id,
                            "X-Auth-Token": vobiz_auth_secret,
                            "Content-Type": "application/x-www-form-urlencoded"
                        }

                        response = requests.post(
                            url,
                            data=payload,
                            headers=headers,
                            timeout=10
                        )

                        if response.status_code in [200, 201, 202]:
                            call_sid = response.json().get("request_uuid")
                            campaign_call.twilio_call_sid = call_sid # Reusing field for Vobiz UUID
                            campaign_call.call_status = "Initiated"
                            # Populate call context for the WebSocket bridge to pick up
                            try:
                                from app.routes.voice_calls import _call_context
                                _call_context[call_sid] = {"farmer_name": farmer.name}
                            except Exception as e:
                                print(f"Failed to populate Vobiz call context: {e}")
                        else:
                            print(f"Vobiz Call Error for Campaign {campaign_id}: {response.text}")
                            campaign_call.call_status = "failed"

                    else:
                        # TWILIO FALLBACK
                        if not twilio_number:
                            print(f"TWILIO_PHONE_NUMBER not configured for Campaign {campaign_id}, Farmer {farmer.id}")
                            campaign_call.call_status = "failed"
                            db.commit()
                            continue

                        # Initiate call via Twilio directly
                        if not local_client:
                            print(f"TWILIO Client not configured for Campaign {campaign_id}, Farmer {farmer.id}")
                            campaign_call.call_status = "failed"
                            db.commit()
                            continue

                        import urllib.parse
                        farmer_twiml_url = f"{twiml_url}?farmer_name={urllib.parse.quote(farmer.name)}"

                        call = local_client.calls.create(
                            to=recipient_phone,
                            from_=twilio_number,
                            url=farmer_twiml_url,
                            status_callback=status_callback_url,
                            status_callback_event=["initiated", "ringing", "answered", "completed"],
                            status_callback_method="POST"
                        )
                        campaign_call.twilio_call_sid = call.sid
                        campaign_call.call_status = "Initiated"

                    db.commit()
            except Exception as e:
                print(f"Twilio Call Error for Campaign {campaign_id}, Farmer {farmer.id}: {e}")
                campaign_call.call_status = "failed"
                db.commit()
                
            # Sleep briefly to avoid hitting Twilio rate limits
            await asyncio.sleep(1)
            
    except Exception as e:
        print(f"Error executing campaign {campaign_id}: {e}")
        db.rollback()
        campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
        if campaign:
            campaign.status = "Failed"
            db.commit()
    finally:
        db.close()

def check_and_update_campaign_status(campaign_id: int, db: Session):
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        return

    # Get expected farmers count
    expected_farmers_count = len(campaign.farmers)
    
    # Get campaign calls created so far
    created_calls = db.query(CampaignCall).filter(CampaignCall.campaign_id == campaign_id).all()
    
    # If not all calls have been initiated yet, do not mark as completed
    if len(created_calls) < expected_farmers_count:
        return
        
    # Check if there are any calls that are still in progress
    running_calls = sum(1 for c in created_calls if c.call_status in ["Initiated", "queued", "ringing", "in-progress"])
    
    if running_calls == 0:
        if campaign.status == "Running":
            campaign.status = "Completed"
            db.commit()

def sync_active_campaigns_status(db: Session):
    local_client = get_twilio_client()
    # Find all running campaigns
    running_campaigns = db.query(Campaign).filter(Campaign.status == "Running").all()
    for campaign in running_campaigns:
        # Find active calls
        active_calls = db.query(CampaignCall).filter(
            CampaignCall.campaign_id == campaign.id,
            CampaignCall.call_status.in_(["Initiated", "queued", "ringing", "in-progress"]),
            CampaignCall.twilio_call_sid != None
        ).all()
        
        for call in active_calls:
            try:
                if not local_client:
                    continue
                twilio_call = local_client.calls(call.twilio_call_sid).fetch()
                current_status = twilio_call.status
                if current_status in ["completed", "failed", "busy", "no-answer", "canceled"]:
                    call.call_status = current_status
                    if twilio_call.duration:
                        call.duration = int(twilio_call.duration)
                    db.commit()
                    print(f"Synced Twilio call {call.twilio_call_sid} to {current_status}")
            except Exception as e:
                pass
                
        # Update campaign status
        check_and_update_campaign_status(campaign.id, db)

async def campaign_scheduler_loop():
    print("Campaign Scheduler Loop Started.")
    while True:
        try:
            db = SessionLocal()
            now = datetime.now()
            
            # Sync any active running campaigns from Twilio
            sync_active_campaigns_status(db)
            
            # Find scheduled campaigns that are due
            due_campaigns = db.query(Campaign).filter(
                Campaign.status == "Scheduled",
                Campaign.scheduled_at <= now
            ).all()

            for campaign in due_campaigns:
                print(f"Triggering scheduled campaign {campaign.campaign_name} (ID: {campaign.id})")
                asyncio.create_task(run_campaign_async(campaign.id))
                
        except Exception as e:
            print(f"Campaign Scheduler Error: {e}")
        finally:
            db.close()
        await asyncio.sleep(10) # check every 10 seconds
