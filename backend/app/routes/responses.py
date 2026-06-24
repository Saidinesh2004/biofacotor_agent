from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List, Optional
from datetime import datetime
import json
import os
import requests as http_requests
from app.database import get_db
from app.models.conversation_log import ConversationLog
from app.models.campaign import CampaignCall, Campaign
from app.models.farmer import Farmer
from app.schemas.conversation_log import ConversationLogResponse

router = APIRouter()


def _is_vapi_uuid(call_sid: str) -> bool:
    """Return True if call_sid looks like a VAPI UUID (not a Twilio CA... SID)."""
    if not call_sid:
        return False
    return not call_sid.startswith("CA") and not call_sid.startswith("SM") and len(call_sid) > 30


def sync_vapi_call(call_sid: str, db: Session) -> bool:
    """
    Fetch call details from VAPI REST API and update ConversationLog + CampaignCall.
    Returns True if anything was updated.
    """
    from dotenv import load_dotenv
    load_dotenv(override=True)

    vapi_key = os.getenv("VAPI_API_KEY", "").strip()
    if not vapi_key or not call_sid:
        return False

    try:
        resp = http_requests.get(
            f"https://api.vapi.ai/call/{call_sid}",
            headers={"Authorization": f"Bearer {vapi_key}"},
            timeout=8
        )
        if resp.status_code != 200:
            return False

        data = resp.json()
        call_status = data.get("status", "")
        ended_reason = data.get("endedReason", "")
        transcript_str = data.get("transcript", "") or ""
        analysis = data.get("analysis", {}) or {}
        vapi_summary = analysis.get("summary", "") or ""

        # Compute duration
        duration_secs = None
        try:
            from datetime import datetime as dt
            started = data.get("startedAt", "")
            ended = data.get("endedAt", "")
            if started and ended:
                fmt = "%Y-%m-%dT%H:%M:%S.%fZ"
                duration_secs = int((dt.strptime(ended, fmt) - dt.strptime(started, fmt)).total_seconds())
        except Exception:
            pass

        if ended_reason in ["customer-busy"]:
            final_status = "rejected"
        elif ended_reason in ["customer-did-not-answer"]:
            final_status = "no response"
        else:
            final_status = "completed"
        updated = False

        # Update ConversationLog
        cl = db.query(ConversationLog).filter(ConversationLog.call_sid == call_sid).first()
        if cl:
            if call_status in ["ended", "completed"]:
                cl.call_status = final_status
            if transcript_str and not cl.farmer_responses:
                cl.farmer_responses = transcript_str
            if duration_secs and not cl.call_duration:
                cl.call_duration = duration_secs
            if vapi_summary and not cl.conversation_summary:
                cl.conversation_summary = vapi_summary
            db.commit()
            updated = True

        # Update CampaignCall
        cc = db.query(CampaignCall).filter(CampaignCall.twilio_call_sid == call_sid).first()
        if cc:
            if call_status in ["ended", "completed"]:
                cc.call_status = final_status
            if transcript_str and not cc.transcript:
                cc.transcript = transcript_str
            if duration_secs and not cc.duration:
                cc.duration = duration_secs
            if vapi_summary and not cc.summary:
                cc.summary = vapi_summary
            db.commit()
            updated = True

        # If we got a transcript but no English summary yet, generate one in background
        if transcript_str and cl and not cl.conversation_summary:
            from app.routes.voice_calls import translate_and_summarize
            import threading
            def _gen_summary(cid, transcript, fname):
                from app.database import SessionLocal
                idb = SessionLocal()
                try:
                    result = translate_and_summarize(transcript, fname)
                    eng = result.get("english_summary", "")
                    if eng:
                        c = idb.query(ConversationLog).filter(ConversationLog.call_sid == cid).first()
                        if c:
                            c.conversation_summary = eng
                            idb.commit()
                        if cc:
                            c2 = idb.query(CampaignCall).filter(CampaignCall.twilio_call_sid == cid).first()
                            if c2:
                                c2.summary = eng
                                idb.commit()
                finally:
                    idb.close()
            threading.Thread(target=_gen_summary, args=(call_sid, transcript_str, cl.farmer_name or "Farmer"), daemon=True).start()

        return updated
    except Exception as e:
        print(f"[VAPI Sync] Error fetching call {call_sid}: {e}")
        return False


@router.get("/", response_model=List[ConversationLogResponse])
def get_responses(
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    village: Optional[str] = None,
    crop: Optional[str] = None,
    campaign_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    # Sync any recent VAPI calls that are missing duration/transcript
    from datetime import timedelta
    cutoff = datetime.utcnow() - timedelta(hours=24)
    vapi_pending = db.query(ConversationLog).filter(
        ConversationLog.created_at >= cutoff,
        ConversationLog.call_status.in_(["completed", "Initiated"])
    ).filter(
        (ConversationLog.call_duration == None) | (ConversationLog.farmer_responses == None)
    ).all()
    for log in vapi_pending:
        if _is_vapi_uuid(log.call_sid):
            sync_vapi_call(log.call_sid, db)

    # 1. Fetch direct calls (ConversationLog)
    direct_query = db.query(ConversationLog).join(Farmer, ConversationLog.farmer_id == Farmer.id, isouter=True)

    if search:
        direct_query = direct_query.filter(
            (ConversationLog.farmer_name.ilike(f"%{search}%")) |
            (ConversationLog.phone_number.ilike(f"%{search}%")) |
            (ConversationLog.conversation_summary.ilike(f"%{search}%"))
        )
    if village:
        direct_query = direct_query.filter(Farmer.village.ilike(f"%{village}%"))
    if crop:
        direct_query = direct_query.filter(Farmer.crop.ilike(f"%{crop}%"))
    if campaign_id:
        # If filtering by a specific campaign, direct calls will not match
        direct_query = direct_query.filter(ConversationLog.id == -1)
        
    direct_logs = direct_query.all()
    
    unified_list = []
    for log in direct_logs:
        unified_list.append({
            "id": log.id,
            "farmer_id": log.farmer_id,
            "farmer_name": log.farmer_name,
            "phone_number": log.phone_number,
            "call_sid": log.call_sid,
            "elevenlabs_conversation_id": log.elevenlabs_conversation_id,
            "call_status": log.call_status,
            "call_duration": log.call_duration,
            "conversation_summary": log.conversation_summary,
            "farmer_responses": log.farmer_responses,
            "created_at": log.created_at,
            "campaign_name": "Direct Call"
        })
        
    # 2. Fetch campaign calls (CampaignCall)
    campaign_query = db.query(CampaignCall).join(Campaign).join(Farmer, CampaignCall.farmer_id == Farmer.id)
    
    if search:
        campaign_query = campaign_query.filter(
            (Farmer.name.ilike(f"%{search}%")) |
            (Farmer.phone.ilike(f"%{search}%")) |
            (CampaignCall.summary.ilike(f"%{search}%")) |
            (Campaign.campaign_name.ilike(f"%{search}%"))
        )
    if village:
        campaign_query = campaign_query.filter(Farmer.village.ilike(f"%{village}%"))
    if crop:
        campaign_query = campaign_query.filter(Farmer.crop.ilike(f"%{crop}%"))
    if campaign_id:
        campaign_query = campaign_query.filter(CampaignCall.campaign_id == campaign_id)
        
    campaign_calls = campaign_query.all()
    
    for cc in campaign_calls:
        # Check if transcript can be loaded as JSON list
        responses_val = cc.transcript
        if responses_val and isinstance(responses_val, str) and (responses_val.startswith("[") or responses_val.startswith("{")):
            try:
                responses_val = json.loads(responses_val)
            except Exception:
                pass
                
        unified_list.append({
            "id": cc.id,
            "farmer_id": cc.farmer_id,
            "farmer_name": cc.farmer.name if cc.farmer else "Unknown",
            "phone_number": cc.farmer.phone if cc.farmer else "Unknown",
            "call_sid": cc.twilio_call_sid,
            "elevenlabs_conversation_id": cc.elevenlabs_conversation_id,
            "call_status": cc.call_status,
            "call_duration": cc.duration,
            "conversation_summary": cc.summary,
            "farmer_responses": responses_val,
            "created_at": cc.created_at,
            "campaign_name": cc.campaign.campaign_name if cc.campaign else "Unknown Campaign"
        })
        
    # Sort unified list chronologically (descending)
    unified_list.sort(key=lambda x: x["created_at"] or datetime.min, reverse=True)
    
    # Apply pagination
    paginated_list = unified_list[skip:skip+limit]
    return paginated_list


@router.get("/{call_id}")
def get_response_detail(
    call_id: int,
    call_type: str,  # "direct" or "campaign"
    db: Session = Depends(get_db)
):
    import requests
    from app.models.voice_call import VoiceCall
    from app.scheduler import get_twilio_client

    api_key = os.getenv("ELEVENLABS_API_KEY")
    twilio_client = None

    if call_type == "direct":
        log = db.query(ConversationLog).filter(ConversationLog.id == call_id).first()
        if not log:
            raise HTTPException(status_code=404, detail="Response not found")

        # Sync from VAPI API if it's a VAPI UUID call with missing data
        if _is_vapi_uuid(log.call_sid) and (not log.call_duration or not log.farmer_responses):
            sync_vapi_call(log.call_sid, db)
            db.refresh(log)  # reload after sync

        updated = False
        # Sync via ElevenLabs conversation ID if available
        if api_key and log.elevenlabs_conversation_id and not log.conversation_summary:
            url = f"https://api.elevenlabs.io/v1/convai/conversations/{log.elevenlabs_conversation_id}"
            headers = {"xi-api-key": api_key}
            try:
                resp = requests.get(url, headers=headers, timeout=5)
                if resp.status_code == 200:
                    cdata = resp.json()
                    status_done = cdata.get("status") in ["done", "failed"]
                    if status_done:
                        log.call_status = "completed" if cdata.get("status") == "done" else "failed"
                        metadata = cdata.get("metadata", {})
                        if metadata.get("call_duration_secs"):
                            log.call_duration = int(metadata.get("call_duration_secs"))
                        analysis = cdata.get("analysis", {})
                        if analysis:
                            log.conversation_summary = analysis.get("transcript_summary") or analysis.get("summary") or "Conversation completed."
                        if cdata.get("transcript"):
                            log.farmer_responses = cdata.get("transcript")
                        db.commit()
                        updated = True
            except Exception as e:
                print(f"Failed to sync direct log {log.id} from ElevenLabs: {e}")

        # Sync via Twilio if ElevenLabs wasn't ready/updated
        if not updated and log.call_sid and log.call_sid.startswith("CA") and not log.call_duration:
            if twilio_client is None:
                twilio_client = get_twilio_client()
            if twilio_client:
                try:
                    twilio_call = twilio_client.calls(log.call_sid).fetch()
                    if twilio_call.status in ["completed", "failed", "busy", "no-answer", "canceled"]:
                        log.call_status = twilio_call.status
                        if twilio_call.duration:
                            log.call_duration = int(twilio_call.duration)
                        db.commit()
                        updated = True
                except Exception as e:
                    print(f"Failed to sync direct log {log.id} from Twilio: {e}")

        if updated:
            voice_call = db.query(VoiceCall).filter(VoiceCall.call_sid == log.call_sid).first()
            if voice_call:
                voice_call.status = log.call_status.replace("-", " ").title()
                db.commit()

        return {
            "id": log.id,
            "farmer_id": log.farmer_id,
            "farmer_name": log.farmer_name,
            "phone_number": log.phone_number,
            "call_sid": log.call_sid,
            "elevenlabs_conversation_id": log.elevenlabs_conversation_id,
            "call_status": log.call_status,
            "call_duration": log.call_duration,
            "conversation_summary": log.conversation_summary,
            "farmer_responses": log.farmer_responses,
            "created_at": log.created_at,
            "campaign_name": "Direct Call"
        }

    elif call_type == "campaign":
        cc = db.query(CampaignCall).filter(CampaignCall.id == call_id).first()
        if not cc:
            raise HTTPException(status_code=404, detail="Campaign call not found")

        updated = False
        if api_key and cc.elevenlabs_conversation_id and not cc.summary:
            url = f"https://api.elevenlabs.io/v1/convai/conversations/{cc.elevenlabs_conversation_id}"
            headers = {"xi-api-key": api_key}
            try:
                resp = requests.get(url, headers=headers, timeout=5)
                if resp.status_code == 200:
                    cdata = resp.json()
                    status_done = cdata.get("status") in ["done", "failed"]
                    if status_done:
                        cc.call_status = "completed" if cdata.get("status") == "done" else "failed"
                        metadata = cdata.get("metadata", {})
                        if metadata.get("call_duration_secs"):
                            cc.duration = int(metadata.get("call_duration_secs"))
                        analysis = cdata.get("analysis", {})
                        if analysis:
                            cc.summary = analysis.get("transcript_summary") or analysis.get("summary") or "Conversation completed."
                        if cdata.get("transcript"):
                            trans_list = cdata.get("transcript")
                            formatted_trans = "\n".join([f"{msg.get('role', 'unknown').capitalize()}: {msg.get('message', msg.get('content', ''))}" for msg in trans_list])
                            cc.transcript = formatted_trans
                        db.commit()
                        from app.scheduler import check_and_update_campaign_status
                        check_and_update_campaign_status(cc.campaign_id, db)
                        updated = True
            except Exception as e:
                print(f"Failed to sync campaign call {cc.id} from ElevenLabs: {e}")

        if not updated and cc.twilio_call_sid and cc.twilio_call_sid.startswith("CA") and not cc.duration:
            if twilio_client is None:
                twilio_client = get_twilio_client()
            if twilio_client:
                try:
                    twilio_call = twilio_client.calls(cc.twilio_call_sid).fetch()
                    if twilio_call.status in ["completed", "failed", "busy", "no-answer", "canceled"]:
                        cc.call_status = twilio_call.status
                        if twilio_call.duration:
                            cc.duration = int(twilio_call.duration)
                        db.commit()
                        from app.scheduler import check_and_update_campaign_status
                        check_and_update_campaign_status(cc.campaign_id, db)
                except Exception as e:
                    print(f"Failed to sync campaign call {cc.id} from Twilio: {e}")

        responses_val = cc.transcript
        if responses_val and (responses_val.startswith("[") or responses_val.startswith("{")):
            try:
                responses_val = json.loads(responses_val)
            except:
                pass

        return {
            "id": cc.id,
            "farmer_id": cc.farmer_id,
            "farmer_name": cc.farmer.name if cc.farmer else "Unknown",
            "phone_number": cc.farmer.phone if cc.farmer else "Unknown",
            "call_sid": cc.twilio_call_sid,
            "elevenlabs_conversation_id": cc.elevenlabs_conversation_id,
            "call_status": cc.call_status,
            "call_duration": cc.duration,
            "conversation_summary": cc.summary,
            "farmer_responses": responses_val,
            "created_at": cc.created_at,
            "campaign_name": cc.campaign.campaign_name if cc.campaign else "Unknown Campaign"
        }
    else:
        raise HTTPException(status_code=400, detail="Invalid call type")


@router.post("/regenerate-summaries")
def regenerate_summaries(background_tasks: BackgroundTasks, force: bool = False, db: Session = Depends(get_db)):
    """
    Batch job: translate all Telugu transcripts to English and generate summaries.
    Set force=true to reprocess ALL records with transcripts (even if summary already exists).
    """
    from app.routes.voice_calls import translate_and_summarize

    # Count what needs processing
    if force:
        pending_logs_count = db.query(ConversationLog).filter(ConversationLog.farmer_responses != None).count()
        pending_calls_count = db.query(CampaignCall).filter(CampaignCall.transcript != None).count()
    else:
        pending_logs_count = db.query(ConversationLog).filter(
            ConversationLog.farmer_responses != None,
            ConversationLog.conversation_summary == None
        ).count()
        pending_calls_count = db.query(CampaignCall).filter(
            CampaignCall.transcript != None,
            CampaignCall.summary == None
        ).count()

    total = pending_logs_count + pending_calls_count

    def process_all():
        import json as _json
        from app.database import SessionLocal
        inner_db = SessionLocal()
        try:
            # Process direct ConversationLogs
            log_query = inner_db.query(ConversationLog).filter(ConversationLog.farmer_responses != None)
            if not force:
                log_query = log_query.filter(ConversationLog.conversation_summary == None)
            logs = log_query.all()

            for log in logs:
                try:
                    raw = log.farmer_responses
                    if isinstance(raw, (list, dict)):
                        raw = _json.dumps(raw, ensure_ascii=False)
                    if not raw or not str(raw).strip():
                        continue
                    result = translate_and_summarize(str(raw), log.farmer_name or "Farmer")
                    log.conversation_summary = result["english_summary"]
                    inner_db.commit()
                    print(f"[Regenerate] ConversationLog id={log.id} ({log.farmer_name}) ✓")
                except Exception as ex:
                    print(f"[Regenerate] Error on ConversationLog id={log.id}: {ex}")

            # Process CampaignCalls
            cc_query = inner_db.query(CampaignCall).filter(CampaignCall.transcript != None)
            if not force:
                cc_query = cc_query.filter(CampaignCall.summary == None)
            calls = cc_query.all()

            for cc in calls:
                try:
                    if not cc.transcript or not str(cc.transcript).strip():
                        continue
                    farmer_name = cc.farmer.name if cc.farmer else "Farmer"
                    result = translate_and_summarize(str(cc.transcript), farmer_name)
                    cc.summary = result["english_summary"]
                    inner_db.commit()
                    print(f"[Regenerate] CampaignCall id={cc.id} ({farmer_name}) ✓")
                except Exception as ex:
                    print(f"[Regenerate] Error on CampaignCall id={cc.id}: {ex}")

            print(f"[Regenerate] Done — processed all records.")
        except Exception as e:
            print(f"[Regenerate] Fatal error: {e}")
        finally:
            inner_db.close()

    background_tasks.add_task(process_all)
    return {
        "status": "started",
        "total": total,
        "message": f"Translating & summarizing {total} records in background. Refresh the Responses page in ~60 seconds."
    }
