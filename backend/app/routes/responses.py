from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List, Optional
from datetime import datetime
import json
from app.database import get_db
from app.models.conversation_log import ConversationLog
from app.models.campaign import CampaignCall, Campaign
from app.models.farmer import Farmer
from app.schemas.conversation_log import ConversationLogResponse

router = APIRouter()

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
    # Sync pending call logs (from last 24 hours) from ElevenLabs / Twilio before querying
    import os
    import requests
    from datetime import datetime, timedelta
    from app.models.voice_call import VoiceCall
    from app.scheduler import get_twilio_client

    cutoff = datetime.utcnow() - timedelta(hours=24)
    api_key = os.getenv("ELEVENLABS_API_KEY")
    twilio_client = None

    # A. Sync ConversationLog (direct calls)
    try:
        from sqlalchemy import or_, and_
        pending_direct = db.query(ConversationLog).filter(
            or_(
                ConversationLog.call_status.in_(["Initiated", "queued", "ringing", "in-progress", "started"]),
                and_(ConversationLog.call_status == "completed", ConversationLog.conversation_summary == None)
            ),
            ConversationLog.created_at >= cutoff
        ).all()

        for log in pending_direct:
            updated = False
            # 1. Try syncing via ElevenLabs conversation ID if available
            if api_key and log.elevenlabs_conversation_id:
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

            # 2. Try syncing via Twilio Call SID
            if not updated and log.call_sid and log.call_sid.startswith("CA"):
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
                # Sync corresponding VoiceCall status
                voice_call = db.query(VoiceCall).filter(VoiceCall.call_sid == log.call_sid).first()
                if voice_call:
                    voice_call.status = log.call_status.replace("-", " ").title()
                    db.commit()
    except Exception as e:
        print(f"Error checking pending direct calls: {e}")

    # B. Sync CampaignCall (campaign calls)
    try:
        from sqlalchemy import or_, and_
        pending_campaign = db.query(CampaignCall).filter(
            or_(
                CampaignCall.call_status.in_(["Initiated", "queued", "ringing", "in-progress", "started"]),
                and_(CampaignCall.call_status == "completed", CampaignCall.summary == None)
            ),
            CampaignCall.created_at >= cutoff
        ).all()

        for cc in pending_campaign:
            updated = False
            # 1. Try syncing via ElevenLabs conversation ID if available
            if api_key and cc.elevenlabs_conversation_id:
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

            # 2. Try syncing via Twilio Call SID
            if not updated and cc.twilio_call_sid and cc.twilio_call_sid.startswith("CA"):
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
    except Exception as e:
        print(f"Error checking pending campaign calls: {e}")

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
        if responses_val and (responses_val.startswith("[") or responses_val.startswith("{")):
            try:
                responses_val = json.loads(responses_val)
            except:
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
    import os
    import requests
    from app.models.voice_call import VoiceCall
    from app.scheduler import get_twilio_client

    api_key = os.getenv("ELEVENLABS_API_KEY")
    twilio_client = None

    if call_type == "direct":
        log = db.query(ConversationLog).filter(ConversationLog.id == call_id).first()
        if not log:
            raise HTTPException(status_code=404, detail="Response not found")
        
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
