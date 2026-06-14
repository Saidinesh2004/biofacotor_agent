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

# Initialize Twilio Client
twilio_client = Client(
    os.getenv("TWILIO_ACCOUNT_SID"), 
    os.getenv("TWILIO_AUTH_TOKEN")
)

@router.post("/twiml")
def get_twiml():
    agent_id = os.getenv("ELEVENLABS_AGENT_ID")
    twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Connect>
        <Stream url="wss://api.elevenlabs.io/v1/convai/conversation?agent_id={agent_id}">
        </Stream>
    </Connect>
</Response>"""
    return Response(content=twiml, media_type="application/xml")

@router.post("/", response_model=VoiceCallResponse, status_code=status.HTTP_201_CREATED)
def create_voice_call(voice_call: VoiceCallCreate, request: Request, db: Session = Depends(get_db)):
    try:
        base_url = os.getenv("NGROK_URL") or str(request.base_url).rstrip("/")
        twiml_url = f"{base_url}/voice-calls/twiml"
        status_callback_url = f"{base_url}/voice-calls/twilio-status"
        
        twilio_number = os.getenv("TWILIO_PHONE_NUMBER")
        recipient_phone = voice_call.phone if voice_call.phone.startswith("+") else f"+{voice_call.phone}"
        
        call = twilio_client.calls.create(
            to=recipient_phone,
            from_=twilio_number,
            url=twiml_url,
            status_callback=status_callback_url,
            status_callback_event=['completed', 'failed', 'busy', 'no-answer', 'canceled']
        )
        
        db_call = voice_call.model_dump()
        db_call["status"] = "Initiated"
        new_call = VoiceCall(**db_call)
        
        db.add(new_call)
        db.commit()
        db.refresh(new_call)
        
        # Also create a pending conversation log entry
        farmer = db.query(Farmer).filter(Farmer.id == voice_call.farmer_id).first()
        farmer_name = farmer.name if farmer else "Unknown"
        conv_log = ConversationLog(
            farmer_id=voice_call.farmer_id,
            farmer_name=farmer_name,
            phone_number=recipient_phone,
            call_sid=call.sid,
            call_status="Initiated"
        )
        db.add(conv_log)
        db.commit()
        
        return new_call
    except Exception as e:
        print(f"Twilio Call Error: {e}")
        db_call = voice_call.model_dump()
        db_call["status"] = "Failed"
        new_call = VoiceCall(**db_call)
        db.add(new_call)
        db.commit()
        db.refresh(new_call)
        raise HTTPException(status_code=500, detail=f"Failed to initiate call: {str(e)}")

@router.get("/", response_model=List[VoiceCallResponse])
def get_voice_calls(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    calls = db.query(VoiceCall).offset(skip).limit(limit).all()
    return calls

@router.post("/twilio-status")
async def twilio_status(request: Request, db: Session = Depends(get_db)):
    form_data = await request.form()
    call_sid = form_data.get("CallSid")
    call_status = form_data.get("CallStatus")
    
    if call_sid and call_status:
        # Update conversation log
        conv_log = db.query(ConversationLog).filter(ConversationLog.call_sid == call_sid).first()
        if conv_log:
            conv_log.call_status = call_status
            db.commit()
            
    return Response(status_code=200)

@router.post("/elevenlabs-webhook")
async def elevenlabs_webhook(request: Request, db: Session = Depends(get_db)):
    try:
        payload = await request.json()
        agent_id = payload.get("agent_id")
        conversation_id = payload.get("conversation_id")
        
        # In a real scenario, ElevenLabs webhook might not send CallSid directly.
        # We might have to map it via custom variables or use the latest initiated call for that agent.
        # Here we'll try to find a recent call that hasn't been completed yet.
        # Alternatively, if phone number is passed in payload:
        # Assuming the payload contains conversation details
        
        transcript = payload.get("transcript", [])
        summary = payload.get("analysis", {}).get("summary", "No summary available")
        
        # Just grab the most recent conversation log that lacks a summary
        # In a robust implementation, you'd pass custom metadata (like call_sid) to ElevenLabs.
        conv_log = db.query(ConversationLog).filter(
            ConversationLog.conversation_summary == None
        ).order_by(ConversationLog.created_at.desc()).first()
        
        if conv_log:
            conv_log.elevenlabs_conversation_id = conversation_id
            conv_log.conversation_summary = summary
            conv_log.farmer_responses = transcript
            db.commit()
            
        return {"status": "success"}
    except Exception as e:
        print(f"ElevenLabs Webhook Error: {e}")
        return {"status": "error", "message": str(e)}
