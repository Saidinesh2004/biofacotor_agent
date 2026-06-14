from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, date
from app.database import get_db
from app.models.farmer import Farmer
from app.models.voice_call import VoiceCall
from app.models.conversation_log import ConversationLog
from app.schemas.dashboard import DashboardStats

router = APIRouter()

@router.get("/stats", response_model=DashboardStats)
def get_dashboard_stats(db: Session = Depends(get_db)):
    today = date.today()
    
    total_farmers = db.query(func.count(Farmer.id)).scalar() or 0
    calls_initiated = db.query(func.count(VoiceCall.id)).scalar() or 0
    calls_completed = db.query(func.count(ConversationLog.id)).filter(
        ConversationLog.call_status == "completed"
    ).scalar() or 0
    calls_failed = db.query(func.count(ConversationLog.id)).filter(
        ConversationLog.call_status.in_(["failed", "busy", "no-answer", "canceled"])
    ).scalar() or 0
    total_responses = db.query(func.count(ConversationLog.id)).filter(
        ConversationLog.conversation_summary != None
    ).scalar() or 0
    
    today_calls = db.query(func.count(VoiceCall.id)).filter(
        func.date(VoiceCall.created_at) == today
    ).scalar() or 0
    
    today_responses = db.query(func.count(ConversationLog.id)).filter(
        func.date(ConversationLog.created_at) == today,
        ConversationLog.conversation_summary != None
    ).scalar() or 0
    
    return DashboardStats(
        total_farmers=total_farmers,
        calls_initiated=calls_initiated,
        calls_completed=calls_completed,
        calls_failed=calls_failed,
        total_responses=total_responses,
        today_calls=today_calls,
        today_responses=today_responses
    )
