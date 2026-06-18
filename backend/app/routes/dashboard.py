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
    from app.models.campaign import Campaign, CampaignCall
    today = date.today()
    
    # Direct calls metrics
    total_farmers = db.query(func.count(Farmer.id)).scalar() or 0
    calls_initiated = db.query(func.count(VoiceCall.id)).scalar() or 0
    direct_completed = db.query(func.count(ConversationLog.id)).filter(
        ConversationLog.call_status.in_(["completed", "Completed"])
    ).scalar() or 0
    direct_failed = db.query(func.count(ConversationLog.id)).filter(
        ConversationLog.call_status.in_(["failed", "busy", "no-answer", "canceled", "Failed"])
    ).scalar() or 0
    direct_responses = db.query(func.count(ConversationLog.id)).filter(
        ConversationLog.conversation_summary != None
    ).scalar() or 0
    
    # Campaigns metrics
    total_campaigns = db.query(func.count(Campaign.id)).scalar() or 0
    scheduled_campaigns = db.query(func.count(Campaign.id)).filter(Campaign.status == "Scheduled").scalar() or 0
    running_campaigns = db.query(func.count(Campaign.id)).filter(Campaign.status == "Running").scalar() or 0
    completed_campaigns = db.query(func.count(Campaign.id)).filter(Campaign.status == "Completed").scalar() or 0
    failed_campaigns = db.query(func.count(Campaign.id)).filter(Campaign.status == "Failed").scalar() or 0
    
    # Campaign calls metrics
    campaign_calls_completed = db.query(func.count(CampaignCall.id)).filter(
        CampaignCall.call_status.in_(["completed", "Completed"])
    ).scalar() or 0
    campaign_calls_failed = db.query(func.count(CampaignCall.id)).filter(
        CampaignCall.call_status.in_(["failed", "busy", "no-answer", "canceled", "Failed"])
    ).scalar() or 0
    campaign_responses = db.query(func.count(CampaignCall.id)).filter(
        CampaignCall.summary != None
    ).scalar() or 0
    
    # Consolidation
    total_calls_completed = direct_completed + campaign_calls_completed
    total_calls_failed = direct_failed + campaign_calls_failed
    total_responses_received = direct_responses + campaign_responses
    
    # Unique farmers contacted
    campaign_farmers = db.query(CampaignCall.farmer_id).distinct()
    direct_farmers = db.query(VoiceCall.farmer_id).distinct()
    total_farmers_contacted = campaign_farmers.union(direct_farmers).count()
    
    # Today's activity
    today_direct_calls = db.query(func.count(VoiceCall.id)).filter(
        func.date(VoiceCall.created_at) == today
    ).scalar() or 0
    today_campaign_calls = db.query(func.count(CampaignCall.id)).filter(
        func.date(CampaignCall.created_at) == today
    ).scalar() or 0
    today_calls = today_direct_calls + today_campaign_calls
    
    today_direct_responses = db.query(func.count(ConversationLog.id)).filter(
        func.date(ConversationLog.created_at) == today,
        ConversationLog.conversation_summary != None
    ).scalar() or 0
    today_campaign_responses = db.query(func.count(CampaignCall.id)).filter(
        func.date(CampaignCall.created_at) == today,
        CampaignCall.summary != None
    ).scalar() or 0
    today_responses = today_direct_responses + today_campaign_responses
    
    return DashboardStats(
        total_farmers=total_farmers,
        calls_initiated=calls_initiated + db.query(func.count(CampaignCall.id)).scalar(),
        calls_completed=total_calls_completed,
        calls_failed=total_calls_failed,
        total_responses=total_responses_received,
        today_calls=today_calls,
        today_responses=today_responses,
        total_campaigns=total_campaigns,
        scheduled_campaigns=scheduled_campaigns,
        running_campaigns=running_campaigns,
        completed_campaigns=completed_campaigns,
        failed_campaigns=failed_campaigns,
        total_farmers_contacted=total_farmers_contacted,
        total_calls_completed=total_calls_completed,
        total_responses_received=total_responses_received
    )
