from fastapi import APIRouter, Depends, status, HTTPException, Request, BackgroundTasks
from fastapi.responses import Response
from sqlalchemy.orm import Session
from typing import List
import os
import requests
import json
from app.database import get_db
from app.models.voice_call import VoiceCall
from app.models.conversation_log import ConversationLog
from app.schemas.voice_call import VoiceCallCreate, VoiceCallResponse
from app.models.farmer import Farmer

router = APIRouter()


def translate_and_summarize(transcript: str, farmer_name: str = "Farmer") -> dict:
    """
    Use Azure OpenAI to generate an English summary from a Telugu transcript.
    The transcript itself is kept in its original language (Telugu).
    Returns a dict with keys: 'telugu_transcript' (original) and 'english_summary'.
    """
    from dotenv import load_dotenv
    load_dotenv(override=True)
    from openai import AzureOpenAI

    api_key = os.getenv("AZURE_OPENAI_API_KEY", "").strip()
    endpoint = os.getenv("AZURE_OPENAI_ENDPOINT", "").strip()
    deployment = os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-4.1").strip()
    api_version = os.getenv("AZURE_OPENAI_API_VERSION", "2024-12-01-preview").strip()

    if not api_key or not endpoint:
        return {"telugu_transcript": transcript, "english_summary": ""}

    # Convert transcript to plain text if it's a list/dict
    if isinstance(transcript, (list, dict)):
        transcript_str = json.dumps(transcript, ensure_ascii=False)
    else:
        transcript_str = str(transcript)

    if not transcript_str.strip():
        return {"telugu_transcript": "", "english_summary": ""}

    try:
        client = AzureOpenAI(
            api_key=api_key,
            azure_endpoint=endpoint,
            api_version=api_version
        )

        prompt = f"""
You are analyzing a phone call transcript between an AI agricultural assistant (Biofactor) and a farmer named {farmer_name}.
The transcript may be in Telugu or a mix of Telugu and English.

Your task:
Write a concise English summary (3-5 sentences) covering:
- What the farmer said about their crop/problem
- Key questions or concerns raised
- What the AI recommended or discussed
- Overall outcome of the call

Respond with a JSON object with exactly one key:
- "english_summary": the concise English summary paragraph

Transcript to process:
{transcript_str[:6000]}
"""

        response = client.chat.completions.create(
            model=deployment,
            messages=[
                {"role": "system", "content": "You are an expert agricultural call analyst. Return only valid JSON."},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"},
            temperature=0.2
        )

        data = json.loads(response.choices[0].message.content.strip())
        return {
            "telugu_transcript": transcript_str,
            "english_summary": data.get("english_summary", "")
        }
    except Exception as e:
        print(f"[Azure OpenAI] translate_and_summarize error: {e}")
        return {"telugu_transcript": transcript_str, "english_summary": ""}
def make_vapi_call(recipient_phone: str, farmer_name: str) -> str:
    """
    Initiate an outbound call via VAPI's REST API.
    VAPI handles both the telephony and the AI voice agent.
    Returns the VAPI call ID.
    """
    from dotenv import load_dotenv
    load_dotenv(override=True)

    vapi_api_key = os.getenv("VAPI_API_KEY", "").strip()
    vapi_assistant_id = os.getenv("VAPI_ASSISTANT_ID", "").strip()
    vapi_phone_number_id = os.getenv("VAPI_PHONE_NUMBER_ID", "").strip()

    if not vapi_api_key or not vapi_assistant_id or not vapi_phone_number_id:
        raise Exception("VAPI_API_KEY, VAPI_ASSISTANT_ID, and VAPI_PHONE_NUMBER_ID must be set in .env")

    url = "https://api.vapi.ai/call/phone"
    headers = {
        "Authorization": f"Bearer {vapi_api_key}",
        "Content-Type": "application/json"
    }
    payload = {
        "phoneNumberId": vapi_phone_number_id,
        "assistantId": vapi_assistant_id,
        "customer": {
            "number": recipient_phone,
            "name": farmer_name
        },
        "assistantOverrides": {
            "variableValues": {
                "farmer_name": farmer_name
            }
        }
    }

    resp = requests.post(url, headers=headers, json=payload, timeout=15)
    print(f"[VAPI] Call response status={resp.status_code}: {resp.text}")

    if resp.status_code not in [200, 201]:
        raise Exception(f"VAPI Call Failed ({resp.status_code}): {resp.text}")

    call_data = resp.json()
    call_id = call_data.get("id")
    if not call_id:
        raise Exception(f"VAPI response missing call ID: {call_data}")

    return call_id


@router.post("/", response_model=VoiceCallResponse, status_code=status.HTTP_201_CREATED)
def create_voice_call(voice_call: VoiceCallCreate, db: Session = Depends(get_db)):
    try:
        recipient_phone = voice_call.phone.replace(" ", "").replace("-", "")
        if not recipient_phone.startswith("+"):
            recipient_phone = f"+{recipient_phone}"

        farmer = db.query(Farmer).filter(Farmer.id == voice_call.farmer_id).first()
        farmer_name = farmer.name if farmer else "Farmer"

        # VAPI makes the call directly — handles AI + telephony together
        call_id = make_vapi_call(recipient_phone, farmer_name)
        print(f"[VAPI] Call initiated → call_id={call_id} to {recipient_phone} ({farmer_name})")

        # Save to Database
        db_call_data = voice_call.model_dump()
        db_call_data["status"] = "Initiated"
        db_call_data["call_sid"] = call_id
        new_call = VoiceCall(**db_call_data)
        db.add(new_call)
        db.commit()
        db.refresh(new_call)

        # Log Conversation
        conv_log = ConversationLog(
            farmer_id=voice_call.farmer_id,
            farmer_name=farmer_name,
            phone_number=recipient_phone,
            call_sid=call_id,
            call_status="Initiated"
        )
        db.add(conv_log)
        db.commit()

        return new_call
    except Exception as e:
        print(f"[VAPI] Call Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/", response_model=List[VoiceCallResponse])
def get_voice_calls(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    calls = db.query(VoiceCall).offset(skip).limit(limit).all()
    return calls


@router.post("/vapi-webhook")
async def vapi_webhook(request: Request, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """
    VAPI posts call events here (end-of-call-report, status updates).
    - Telugu transcript is saved IMMEDIATELY to the DB (no AI needed).
    - English summary is generated in background via Azure OpenAI.
    """
    try:
        payload = await request.json()
        message = payload.get("message", {})
        event_type = message.get("type", "")
        call_data = message.get("call", {})

        call_id = call_data.get("id", "")
        raw_transcript = message.get("transcript", "")
        vapi_summary = message.get("analysis", {}).get("summary", "")
        ended_reason = call_data.get("endedReason", "")

        # Compute duration from timestamps
        duration_secs = None
        try:
            from datetime import datetime as dt
            started = call_data.get("startedAt", "")
            ended_at = call_data.get("endedAt", "")
            if started and ended_at:
                fmt = "%Y-%m-%dT%H:%M:%S.%fZ"
                duration_secs = int((dt.strptime(ended_at, fmt) - dt.strptime(started, fmt)).total_seconds())
        except Exception:
            pass

        print(f"[VAPI Webhook] event={event_type} call_id={call_id} ended_reason={ended_reason} duration={duration_secs}s")

        if event_type in ["end-of-call-report", "call-ended"]:
            from app.models.campaign import CampaignCall
            from app.scheduler import check_and_update_campaign_status

            if ended_reason in ["customer-busy"]:
                final_status = "rejected"
            elif ended_reason in ["customer-did-not-answer"]:
                final_status = "no response"
            else:
                final_status = "completed"

            # ── STEP 1: Save Telugu transcript IMMEDIATELY (zero delay) ──────
            conv_log = db.query(ConversationLog).filter(ConversationLog.call_sid == call_id).first()
            if conv_log:
                conv_log.call_status = final_status
                conv_log.farmer_responses = raw_transcript       # Telugu as-is
                if duration_secs:
                    conv_log.call_duration = duration_secs
                if vapi_summary and not conv_log.conversation_summary:
                    conv_log.conversation_summary = vapi_summary  # VAPI fallback
                db.commit()

            voice_call_record = db.query(VoiceCall).filter(VoiceCall.call_sid == call_id).first()
            if voice_call_record:
                voice_call_record.status = final_status.title()
                db.commit()

            campaign_call = db.query(CampaignCall).filter(CampaignCall.twilio_call_sid == call_id).first()
            if campaign_call:
                campaign_call.call_status = final_status
                campaign_call.transcript = raw_transcript        # Telugu as-is
                if duration_secs:
                    campaign_call.duration = duration_secs
                if vapi_summary and not campaign_call.summary:
                    campaign_call.summary = vapi_summary
                db.commit()
                check_and_update_campaign_status(campaign_call.campaign_id, db)

            print(f"[VAPI Webhook] ✓ Telugu transcript saved instantly for call_id={call_id}")

            # ── STEP 2: Generate English summary in background (non-blocking) ─
            if raw_transcript:
                farmer_name = conv_log.farmer_name if conv_log else "Farmer"
                cc_id = campaign_call.id if campaign_call else None

                def generate_summary_bg(cid: str, transcript: str, fname: str, camp_call_id):
                    inner_db = None
                    try:
                        from app.database import SessionLocal
                        inner_db = SessionLocal()

                        result = translate_and_summarize(transcript, fname)
                        eng_summary = result.get("english_summary", "")
                        if not eng_summary:
                            return

                        # Update summary only — transcript stays in Telugu
                        cl = inner_db.query(ConversationLog).filter(ConversationLog.call_sid == cid).first()
                        if cl:
                            cl.conversation_summary = eng_summary
                            inner_db.commit()

                        if camp_call_id:
                            cc = inner_db.query(CampaignCall).filter(CampaignCall.id == camp_call_id).first()
                            if cc:
                                cc.summary = eng_summary
                                inner_db.commit()

                        print(f"[VAPI Webhook] ✓ English summary saved for call_id={cid}")
                    except Exception as ex:
                        print(f"[VAPI Webhook] Summary generation error for {cid}: {ex}")
                    finally:
                        if inner_db:
                            inner_db.close()

                background_tasks.add_task(generate_summary_bg, call_id, raw_transcript, farmer_name, cc_id)

        elif event_type == "status-update":
            call_status = call_data.get("status", "")
            conv_log = db.query(ConversationLog).filter(ConversationLog.call_sid == call_id).first()
            if conv_log and call_status:
                conv_log.call_status = call_status
                db.commit()

        return {"status": "ok"}
    except Exception as e:
        print(f"[VAPI Webhook Error]: {e}")
        return {"status": "error", "message": str(e)}
