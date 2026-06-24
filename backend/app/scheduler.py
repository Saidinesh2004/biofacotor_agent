import os
import asyncio
import requests
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import SessionLocal
from app.models.campaign import Campaign, CampaignCall
from app.models.farmer import Farmer


def get_twilio_client():
    """Return a Twilio client if credentials are configured, else None."""
    from dotenv import load_dotenv
    load_dotenv(override=True)
    sid = os.getenv("TWILIO_ACCOUNT_SID", "").strip()
    token = os.getenv("TWILIO_AUTH_TOKEN", "").strip()
    if sid and token:
        try:
            from twilio.rest import Client
            return Client(sid, token)
        except Exception:
            pass
    return None


def get_vobiz_config():
    """Load Vobiz credentials from environment."""
    from dotenv import load_dotenv
    load_dotenv(override=True)
    return {
        "auth_id": os.getenv("VOBIZ_AUTH_ID", "").strip(),
        "auth_secret": os.getenv("VOBIZ_AUTH_SECRET", "").strip(),
        "app_id": os.getenv("VOBIZ_APP_ID", "").strip(),
        "phone": os.getenv("VOBIZ_PHONE_NUMBER", "").strip(),
    }


async def run_campaign_async(campaign_id: int):
    # Reload environment to pick up updated .env credentials
    from dotenv import load_dotenv
    load_dotenv(override=True)

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
                    # WHATSAPP CAMPAIGN — uses Twilio
                    from twilio.rest import Client
                    twilio_sid = os.getenv("TWILIO_ACCOUNT_SID", "").strip()
                    twilio_token = os.getenv("TWILIO_AUTH_TOKEN", "").strip()
                    twilio_whatsapp = os.getenv("TWILIO_WHATSAPP_NUMBER", "").strip()

                    if not twilio_sid or not twilio_token or not twilio_whatsapp:
                        print(f"Twilio / WhatsApp not configured for Campaign {campaign_id}")
                        campaign_call.call_status = "failed"
                        campaign_call.summary = "Twilio credentials or WhatsApp number missing."
                        db.commit()
                        continue

                    try:
                        local_client = Client(twilio_sid, twilio_token)
                        twilio_response = local_client.messages.create(
                            from_=f"whatsapp:{twilio_whatsapp}",
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
                    # VOICE CAMPAIGN — VAPI makes the call directly (AI + telephony together)
                    from app.routes.voice_calls import make_vapi_call
                    try:
                        call_id = make_vapi_call(recipient_phone, farmer.name)
                        campaign_call.twilio_call_sid = call_id  # reusing field for VAPI call ID
                        campaign_call.call_status = "Initiated"
                        print(f"[VAPI Campaign] Call initiated → call_id={call_id} farmer={farmer.name}")
                    except Exception as vapi_err:
                        print(f"VAPI Call Error for Campaign {campaign_id}: {vapi_err}")
                        campaign_call.call_status = "failed"
                        campaign_call.summary = str(vapi_err)

                    db.commit()


            except Exception as e:
                print(f"Call Error for Campaign {campaign_id}, Farmer {farmer.id}: {e}")
                campaign_call.call_status = "failed"
                db.commit()

            # Sleep briefly to avoid hitting rate limits
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
    # With Vobiz + VAPI, call status is updated via webhook — no polling needed.
    # Just check if running campaigns have all calls finished.
    running_campaigns = db.query(Campaign).filter(Campaign.status == "Running").all()
    for campaign in running_campaigns:
        check_and_update_campaign_status(campaign.id, db)


async def campaign_scheduler_loop():
    print("Campaign Scheduler Loop Started.")
    while True:
        try:
            db = SessionLocal()
            now = datetime.now()

            # Check if any active running campaigns are now complete
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
        await asyncio.sleep(10)  # check every 10 seconds
