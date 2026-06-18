from fastapi import APIRouter, Depends, status, HTTPException, Request
from fastapi.responses import Response
from sqlalchemy.orm import Session
from typing import List
import os
from twilio.rest import Client
from app.database import get_db
from app.models.voice_call import VoiceCall
from app.models.conversation_log import ConversationLog
from app.schemas.voice_call import VoiceCallCreate, VoiceCallResponse
from app.models.farmer import Farmer

router = APIRouter()

# Shared in-memory store: call_uuid -> farmer_name
# Populated when call is initiated so bridge can look up the farmer's name
_call_context: dict = {}

# Initialize Twilio Client
twilio_sid = os.getenv("TWILIO_ACCOUNT_SID")
twilio_token = os.getenv("TWILIO_AUTH_TOKEN")
twilio_client = Client(twilio_sid, twilio_token) if (twilio_sid and twilio_token) else None

import requests
from requests.auth import HTTPBasicAuth

@router.post("/twiml")
async def get_twiml(request: Request):
    # Retrieve Twilio's POST parameters
    form_data = {}
    try:
        form = await request.form()
        form_data = dict(form)
        from_number = form_data.get("From") or ""
        to_number = form_data.get("To") or ""
    except Exception:
        from_number = ""
        to_number = ""

    # Get farmer_name from query parameters
    farmer_name = request.query_params.get("farmer_name", "Farmer").strip()
    
    agent_id = os.getenv("ELEVENLABS_AGENT_ID", "").strip()
    api_key = os.getenv("ELEVENLABS_API_KEY", "").strip()

    if not agent_id or not api_key:
        return Response(content="<Response><Say>Config Error</Say></Response>", media_type="application/xml")

    # Call ElevenLabs Register Call API to support dynamic variables
    if from_number and to_number:
        try:
            url = "https://api.elevenlabs.io/v1/convai/twilio/register-call"
            headers = {
                "xi-api-key": api_key,
                "Content-Type": "application/json"
            }
            payload = {
                "agent_id": agent_id,
                "from_number": from_number,
                "to_number": to_number,
                "direction": "outbound",
                "conversation_initiation_client_data": {
                    "type": "conversation_initiation_client_data",
                    "dynamic_variables": {
                        "farmer_name": farmer_name
                    }
                }
            }
            resp = requests.post(url, headers=headers, json=payload, timeout=10)
            if resp.status_code == 200:
                twiml_string = resp.text.strip()
                if twiml_string:
                    print(f"[DEBUG] Successfully registered Twilio call. Dynamic TwiML: {twiml_string}")
                    
                    # Extract conversation ID from the TwiML XML
                    import re
                    conv_id_match = re.search(r'value="([^"]+)"', twiml_string)
                    if conv_id_match:
                        conversation_id = conv_id_match.group(1)
                        try:
                            call_sid = form_data.get("CallSid")
                            if call_sid:
                                # Fetch a database session manually since we are in a route without Depends
                                from app.database import SessionLocal
                                from app.models.campaign import CampaignCall
                                db = SessionLocal()
                                try:
                                    conv_log = db.query(ConversationLog).filter(ConversationLog.call_sid == call_sid).first()
                                    if conv_log:
                                        conv_log.elevenlabs_conversation_id = conversation_id
                                        db.commit()
                                    
                                    campaign_call = db.query(CampaignCall).filter(CampaignCall.twilio_call_sid == call_sid).first()
                                    if campaign_call:
                                        campaign_call.elevenlabs_conversation_id = conversation_id
                                        db.commit()
                                except Exception as inner_db_err:
                                    print(f"[DEBUG] Inner DB error: {inner_db_err}")
                                    db.rollback()
                                finally:
                                    db.close()
                        except Exception as db_err:
                            print(f"[DEBUG] Error saving conversation ID to DB: {db_err}")
                            
                    return Response(content=twiml_string, media_type="application/xml")
            
            print(f"[DEBUG] Register call failed (status={resp.status_code}): {resp.text}.")
            if resp.status_code in [401, 403]:
                err_msg = "Call registration failed. Your ElevenLabs API key is missing the convai_write permission. Please check your ElevenLabs developer settings."
                err_xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say>{err_msg}</Say>
    <Hangup/>
</Response>"""
                return Response(content=err_xml, media_type="application/xml")
        except Exception as e:
            print(f"[DEBUG] Error registering call with ElevenLabs: {e}.")

    # Fallback TwiML
    twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Connect>
        <Stream url="wss://api.elevenlabs.io/v1/convai/conversation?agent_id={agent_id}" track="both_tracks">
            <Parameter name="xi-api-key" value="{api_key}" />
        </Stream>
    </Connect>
</Response>"""
    return Response(content=twiml, media_type="application/xml")

@router.post("/vobiz-xml")
async def get_vobiz_xml(request: Request):
    ngrok_url = (os.getenv('NGROK_URL') or "").strip()
    ws_bridge_url = ngrok_url.replace("https://", "wss://").replace("http://", "ws://")

    # Vobiz POSTs the answer_url with call details in the form body
    form_dict = {}
    try:
        form = await request.form()
        form_dict = dict(form)
        request_uuid = form_dict.get("RequestUUID") or form_dict.get("request_uuid") or ""
    except Exception:
        request_uuid = request.query_params.get("request_uuid", "")

    # Build bridge URL - include request_uuid so bridge can look up farmer name
    bridge_endpoint = f"{ws_bridge_url}/ws/bridge"
    if request_uuid:
        bridge_endpoint += f"?call_id={request_uuid}"

    xml_content = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Stream bidirectional="true" keepCallAlive="true" contentType="audio/x-mulaw;rate=8000">{bridge_endpoint}</Stream>
    <Wait length="3600" />
</Response>"""
    
    headers_dict = dict(request.headers)
    with open("vobiz_debug.log", "a") as f:
        f.write(f"\n--- Vobiz Request Log ---\n")
        f.write(f"Call ID: {request_uuid}\n")
        f.write(f"Headers: {headers_dict}\n")
        f.write(f"Form Params: {form_dict}\n")
        f.write(f"Query Params: {dict(request.query_params)}\n")
        f.write(f"XML: {xml_content}\n")
        f.write(f"-------------------------\n")
        
    return Response(content=xml_content, media_type="application/xml")


@router.post("/", response_model=VoiceCallResponse, status_code=status.HTTP_201_CREATED)
def create_voice_call(voice_call: VoiceCallCreate, db: Session = Depends(get_db)):
    try:
        recipient_phone = voice_call.phone.replace(" ", "").replace("-", "")
        if not recipient_phone.startswith("+"):
            recipient_phone = f"+{recipient_phone}"

        # Force reload .env so it gets the new ELEVENLABS_PHONE_NUMBER_ID without restarting uvicorn
        from dotenv import load_dotenv
        load_dotenv(override=True)

        vobiz_auth_id = os.getenv("VOBIZ_AUTH_ID", "").strip()
        vobiz_auth_secret = os.getenv("VOBIZ_AUTH_SECRET", "").strip()
        vobiz_app_id = os.getenv("VOBIZ_APP_ID", "").strip()

        # Re-initialize local Twilio client in case env was updated
        t_sid = os.getenv("TWILIO_ACCOUNT_SID", "").strip()
        t_token = os.getenv("TWILIO_AUTH_TOKEN", "").strip()
        t_number = os.getenv("TWILIO_PHONE_NUMBER", "").strip()

        farmer = db.query(Farmer).filter(Farmer.id == voice_call.farmer_id).first()
        farmer_name = farmer.name if farmer else "Farmer"

        if vobiz_auth_id and vobiz_auth_secret and vobiz_app_id:
            # VOBIZ CALL LOGIC
            vobiz_from = os.getenv("VOBIZ_PHONE_NUMBER", "").strip()
            if vobiz_from.startswith("+"):
                vobiz_from = vobiz_from[1:]

            base_url = (os.getenv("NGROK_URL") or "http://localhost:8000").strip()
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

            if response.status_code not in [200, 201, 202]:
                raise Exception(f"Vobiz Call Failed: {response.text}")

            call_sid = response.json().get("request_uuid")
            # Populate call context for the WebSocket bridge to pick up
            _call_context[call_sid] = {"farmer_name": farmer_name}
        elif t_sid and t_token and t_number:
            # DIRECT TWILIO CLIENT CALL LOGIC (using local Twilio credentials from .env)
            from twilio.rest import Client
            local_client = Client(t_sid, t_token)
            base_url = (os.getenv("NGROK_URL") or "http://localhost:8000").strip()
            import urllib.parse
            twiml_url = f"{base_url}/voice-calls/twiml?farmer_name={urllib.parse.quote(farmer_name)}"
            status_callback_url = f"{base_url}/voice-calls/twilio-status"
            
            call = local_client.calls.create(
                to=recipient_phone,
                from_=t_number,
                url=twiml_url,
                status_callback=status_callback_url,
                status_callback_event=["initiated", "ringing", "answered", "completed"],
                status_callback_method="POST"
            )
            call_sid = call.sid
        else:
            # FORCE ELEVENLABS NATIVE TWILIO CALL LOGIC
            agent_id = os.getenv("ELEVENLABS_AGENT_ID", "").strip()
            phone_number_id = os.getenv("ELEVENLABS_PHONE_NUMBER_ID", "").strip()
            api_key = os.getenv("ELEVENLABS_API_KEY", "").strip()

            url = "https://api.elevenlabs.io/v1/convai/twilio/outbound-call"
            headers = {
                "xi-api-key": api_key,
                "Content-Type": "application/json"
            }
            payload = {
                "agent_id": agent_id,
                "agent_phone_number_id": phone_number_id,
                "to_number": recipient_phone,
                "conversation_initiation_client_data": {
                    "type": "conversation_initiation_client_data",
                    "dynamic_variables": {
                        "farmer_name": farmer_name
                    }
                }
            }
            
            resp = requests.post(url, headers=headers, json=payload)
            resp_data = resp.json()
            if resp.status_code != 200:
                raise Exception(f"ElevenLabs Call Failed: {resp_data}")
                
            call_sid = resp_data.get("callSid")

        # Save to Database
        db_call_data = voice_call.model_dump()
        db_call_data["status"] = "Initiated"
        db_call_data["call_sid"] = call_sid
        new_call = VoiceCall(**db_call_data)
        db.add(new_call)
        db.commit()
        db.refresh(new_call)

        # Log Conversation
        conv_log = ConversationLog(
            farmer_id=voice_call.farmer_id,
            farmer_name=farmer_name,
            phone_number=recipient_phone,
            call_sid=call_sid,
            call_status="Initiated"
        )
        db.add(conv_log)
        db.commit()

        return new_call
    except Exception as e:
        print(f"Call Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/", response_model=List[VoiceCallResponse])
def get_voice_calls(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    calls = db.query(VoiceCall).offset(skip).limit(limit).all()
    return calls

@router.post("/twilio-status")
async def twilio_status(request: Request, db: Session = Depends(get_db)):
    form_data = await request.form()
    call_sid = form_data.get("CallSid")
    call_status = form_data.get("CallStatus")
    duration = form_data.get("CallDuration")
    
    if call_sid and call_status:
        print(f"[DEBUG] Twilio Status Update: {call_status} (CallSid: {call_sid})")
        # 1. Update CampaignCall if exists
        from app.models.campaign import CampaignCall
        from app.scheduler import check_and_update_campaign_status
        campaign_call = db.query(CampaignCall).filter(CampaignCall.twilio_call_sid == call_sid).first()
        if campaign_call:
            campaign_call.call_status = call_status
            if duration:
                campaign_call.duration = int(duration)
            db.commit()
            check_and_update_campaign_status(campaign_call.campaign_id, db)
            
        # 2. Update conversation log (direct call)
        conv_log = db.query(ConversationLog).filter(ConversationLog.call_sid == call_sid).first()
        if conv_log:
            conv_log.call_status = call_status
            if duration:
                conv_log.call_duration = int(duration)
            db.commit()

        # 3. Update voice call history (direct call)
        formatted_status = call_status.replace("-", " ").title()
        voice_call = db.query(VoiceCall).filter(VoiceCall.call_sid == call_sid).first()
        if voice_call:
            voice_call.status = formatted_status
            db.commit()
            
    return Response(status_code=200)

@router.post("/elevenlabs-webhook")
async def elevenlabs_webhook(request: Request, db: Session = Depends(get_db)):
    try:
        payload = await request.json()
        agent_id = payload.get("agent_id")
        conversation_id = payload.get("conversation_id")
        
        transcript = payload.get("transcript", [])
        summary = payload.get("analysis", {}).get("summary", "No summary available")
        
        # Extract call_sid from payload if provided
        call_sid = payload.get("call_sid") or payload.get("metadata", {}).get("call_sid") or payload.get("custom_metadata", {}).get("call_sid")
        if not call_sid:
            data = payload.get("data", {})
            if isinstance(data, dict):
                call_sid = data.get("call_sid") or data.get("metadata", {}).get("call_sid") or data.get("custom_metadata", {}).get("call_sid")
                
        # Format transcript as text
        formatted_transcript = ""
        if isinstance(transcript, list):
            formatted_transcript = "\n".join([f"{msg.get('role', 'unknown').capitalize()}: {msg.get('message', msg.get('content', ''))}" for msg in transcript])
        else:
            formatted_transcript = str(transcript)

        # 1. Check CampaignCall
        from app.models.campaign import CampaignCall
        from app.scheduler import check_and_update_campaign_status
        
        campaign_call = None
        if call_sid:
            campaign_call = db.query(CampaignCall).filter(CampaignCall.twilio_call_sid == call_sid).first()
            
        if campaign_call:
            campaign_call.elevenlabs_conversation_id = conversation_id
            campaign_call.summary = summary
            campaign_call.transcript = formatted_transcript
            campaign_call.call_status = "completed"
            db.commit()
            check_and_update_campaign_status(campaign_call.campaign_id, db)
            return {"status": "success"}

        # 2. Check ConversationLog (direct calls)
        conv_log = None
        if call_sid:
            conv_log = db.query(ConversationLog).filter(ConversationLog.call_sid == call_sid).first()
            
        if not conv_log:
            conv_log = db.query(ConversationLog).filter(
                ConversationLog.conversation_summary == None
            ).order_by(ConversationLog.created_at.desc()).first()
            
        if conv_log:
            conv_log.elevenlabs_conversation_id = conversation_id
            conv_log.conversation_summary = summary
            conv_log.farmer_responses = transcript
            conv_log.call_status = "completed"
            db.commit()
            
        return {"status": "success"}
    except Exception as e:
        print(f"ElevenLabs Webhook Error: {e}")
        return {"status": "error", "message": str(e)}
