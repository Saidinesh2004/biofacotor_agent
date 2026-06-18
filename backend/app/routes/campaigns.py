from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime

from app.database import get_db
from app.models.campaign import Campaign, CampaignFarmer, CampaignCall
from app.models.farmer import Farmer
from app.schemas.campaign import (
    CampaignCreate, 
    CampaignResponse, 
    CampaignDetailResponse, 
    CampaignCallResponse,
    CampaignFarmerResponse
)
from app.scheduler import run_campaign_async

router = APIRouter()

@router.post("/", response_model=CampaignResponse, status_code=status.HTTP_201_CREATED)
def create_campaign(campaign: CampaignCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    # Save campaign details
    new_campaign = Campaign(
        campaign_name=campaign.campaign_name,
        description=campaign.description,
        campaign_type=campaign.campaign_type,
        scheduled_at=campaign.scheduled_at,
        status=campaign.status,
        created_by=campaign.created_by
    )
    db.add(new_campaign)
    db.commit()
    db.refresh(new_campaign)

    # Save selected farmers
    for farmer_id in campaign.farmer_ids:
        # Verify farmer exists
        farmer = db.query(Farmer).filter(Farmer.id == farmer_id).first()
        if farmer:
            link = CampaignFarmer(campaign_id=new_campaign.id, farmer_id=farmer_id)
            db.add(link)
    db.commit()
    db.refresh(new_campaign)

    # If the campaign is scheduled to run immediately (or status is running), or if scheduled time is in the past, run it
    is_past = False
    if new_campaign.scheduled_at:
        if new_campaign.scheduled_at.tzinfo is not None:
            is_past = new_campaign.scheduled_at <= datetime.now(new_campaign.scheduled_at.tzinfo)
        else:
            is_past = new_campaign.scheduled_at <= datetime.now()

    if new_campaign.status == "Running" or (new_campaign.status == "Scheduled" and is_past):
        background_tasks.add_task(run_campaign_async, new_campaign.id)

    return new_campaign

@router.post("/{campaign_id}/schedule", response_model=CampaignResponse)
def schedule_campaign(campaign_id: int, scheduled_at: datetime, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    campaign.status = "Scheduled"
    campaign.scheduled_at = scheduled_at
    db.commit()

    is_past = False
    if scheduled_at.tzinfo is not None:
        is_past = scheduled_at <= datetime.now(scheduled_at.tzinfo)
    else:
        is_past = scheduled_at <= datetime.now()

    if is_past:
        background_tasks.add_task(run_campaign_async, campaign.id)

    return campaign

@router.get("/", response_model=List[CampaignResponse])
def get_campaigns(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    campaigns = db.query(Campaign).offset(skip).limit(limit).all()
    # Populate farmers_count
    for c in campaigns:
        c.farmers_count = db.query(CampaignFarmer).filter(CampaignFarmer.campaign_id == c.id).count()
    return campaigns

@router.get("/farmers-selection", response_model=List[CampaignFarmerResponse])
def get_farmers_selection(
    name: Optional[str] = None,
    phone: Optional[str] = None,
    village: Optional[str] = None,
    crop: Optional[str] = None,
    language: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Farmer)
    if name:
        query = query.filter(Farmer.name.ilike(f"%{name}%"))
    if phone:
        query = query.filter(Farmer.phone.ilike(f"%{phone}%"))
    if village:
        query = query.filter(Farmer.village.ilike(f"%{village}%"))
    if crop:
        query = query.filter(Farmer.crop.ilike(f"%{crop}%"))
    if language:
        query = query.filter(Farmer.language.ilike(f"%{language}%"))
    
    return query.all()

@router.get("/{campaign_id}", response_model=CampaignDetailResponse)
def get_campaign(campaign_id: int, db: Session = Depends(get_db)):
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    # Fetch farmers details
    farmers = db.query(Farmer).join(CampaignFarmer).filter(CampaignFarmer.campaign_id == campaign_id).all()
    campaign.farmers = farmers
    campaign.farmers_count = len(farmers)
    return campaign

@router.post("/{campaign_id}/start")
def start_campaign(campaign_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    if campaign.status == "Running":
        raise HTTPException(status_code=400, detail="Campaign is already running")
    
    background_tasks.add_task(run_campaign_async, campaign.id)
    return {"status": "success", "message": f"Campaign {campaign_id} started in the background"}

@router.get("/{campaign_id}/call-logs", response_model=List[CampaignCallResponse])
def get_campaign_call_logs(campaign_id: int, db: Session = Depends(get_db)):
    calls = db.query(CampaignCall).filter(CampaignCall.campaign_id == campaign_id).all()
    
    results = []
    for call in calls:
        farmer_name = call.farmer.name if call.farmer else "Unknown"
        phone_number = call.farmer.phone if call.farmer else "Unknown"
        results.append(
            CampaignCallResponse(
                id=call.id,
                campaign_id=call.campaign_id,
                farmer_id=call.farmer_id,
                farmer_name=farmer_name,
                phone_number=phone_number,
                twilio_call_sid=call.twilio_call_sid,
                elevenlabs_conversation_id=call.elevenlabs_conversation_id,
                call_status=call.call_status,
                duration=call.duration,
                transcript=call.transcript,
                summary=call.summary,
                created_at=call.created_at
            )
        )
    return results

@router.get("/analytics/summary")
def get_campaigns_analytics(db: Session = Depends(get_db)):
    campaigns = db.query(Campaign).all()
    results = []
    for c in campaigns:
        targeted = db.query(CampaignFarmer).filter(CampaignFarmer.campaign_id == c.id).count()
        
        if c.campaign_type == "WhatsApp Campaign":
            reached = db.query(CampaignCall).filter(
                CampaignCall.campaign_id == c.id,
                CampaignCall.call_status.in_(["completed", "Completed"])
            ).count()
            failed = db.query(CampaignCall).filter(
                CampaignCall.campaign_id == c.id,
                CampaignCall.call_status.in_(["failed", "Failed", "busy", "no-answer", "canceled"])
            ).count()
            
            # Exclude missing credentials / failed delivery summary strings to count real replies
            responses = db.query(CampaignCall).filter(
                CampaignCall.campaign_id == c.id,
                CampaignCall.summary != None,
                ~CampaignCall.summary.like("Twilio credentials%"),
                ~CampaignCall.summary.like("WhatsApp failed%")
            ).count()
            
            success_rate = (reached / targeted * 100.0) if targeted > 0 else 0.0
            
            # Campaign Status logic
            if success_rate > 90.0:
                campaign_status = "Successful"
            elif success_rate >= 50.0:
                campaign_status = "Partial Success"
            else:
                campaign_status = "Failed"
                
            results.append({
                "campaign_id": c.id,
                "campaign_name": c.campaign_name,
                "campaign_type": c.campaign_type,
                "created_at": c.created_at,
                "scheduled_at": c.scheduled_at,
                "status": c.status,
                "campaign_status": campaign_status,
                "farmers_targeted": targeted,
                "farmers_reached": reached,
                "calls_answered": None,
                "calls_failed": failed,
                "responses_collected": responses,
                "average_duration": None,
                "success_rate": round(success_rate, 1)
            })
            
        else:
            # Voice Campaign (fallback / default)
            reached = db.query(CampaignCall).filter(
                CampaignCall.campaign_id == c.id,
                CampaignCall.twilio_call_sid != None,
                ~CampaignCall.call_status.in_(["failed", "Failed", "busy", "no-answer", "canceled", "Initiated"])
            ).count()
            answered = db.query(CampaignCall).filter(
                CampaignCall.campaign_id == c.id,
                CampaignCall.call_status.in_(["completed", "Completed", "answered", "Answered"])
            ).count()
            failed = db.query(CampaignCall).filter(
                CampaignCall.campaign_id == c.id,
                CampaignCall.call_status.in_(["failed", "Failed", "busy", "no-answer", "canceled"])
            ).count()
            responses = db.query(CampaignCall).filter(
                CampaignCall.campaign_id == c.id,
                CampaignCall.summary != None
            ).count()
            avg_dur = db.query(func.avg(CampaignCall.duration)).filter(
                CampaignCall.campaign_id == c.id,
                CampaignCall.call_status.in_(["completed", "Completed", "answered", "Answered"]),
                CampaignCall.duration != None
            ).scalar() or 0.0
            
            success_rate = (answered / targeted * 100.0) if targeted > 0 else 0.0
            
            # Campaign Status logic
            if success_rate > 90.0:
                campaign_status = "Successful"
            elif success_rate >= 50.0:
                campaign_status = "Partial Success"
            else:
                campaign_status = "Failed"
                
            results.append({
                "campaign_id": c.id,
                "campaign_name": c.campaign_name,
                "campaign_type": c.campaign_type,
                "created_at": c.created_at,
                "scheduled_at": c.scheduled_at,
                "status": c.status,
                "campaign_status": campaign_status,
                "farmers_targeted": targeted,
                "farmers_reached": reached,
                "calls_answered": answered,
                "calls_failed": failed,
                "responses_collected": responses,
                "average_duration": round(float(avg_dur), 1),
                "success_rate": round(success_rate, 1)
            })
            
    return results

@router.get("/analytics/charts")
def get_charts_data(campaign_id: Optional[int] = None, db: Session = Depends(get_db)):
    query = db.query(CampaignCall)
    if campaign_id:
        query = query.filter(CampaignCall.campaign_id == campaign_id)
        
    calls = query.all()
    
    # Friendly Call / Message Status Distribution
    status_counts = {}
    for call in calls:
        c_type = call.campaign.campaign_type if call.campaign else "Voice Campaign"
        status = call.call_status or "Unknown"
        
        if c_type == "WhatsApp Campaign":
            if status.lower() in ["completed", "sent"]:
                friendly_status = "Reached"
            elif status.lower() in ["failed", "busy", "no-answer", "canceled"]:
                friendly_status = "Failed"
            else:
                friendly_status = status.capitalize()
        else:
            if status.lower() in ["completed", "answered"]:
                friendly_status = "Answered"
            elif status.lower() in ["failed", "busy", "no-answer", "canceled"]:
                friendly_status = "Failed"
            elif status.lower() in ["initiated", "ringing", "queued", "in-progress"]:
                friendly_status = "Initiated"
            else:
                friendly_status = status.capitalize()
                
        status_counts[friendly_status] = status_counts.get(friendly_status, 0) + 1
        
    status_dist = [{"name": k, "value": v} for k, v in status_counts.items()]
    
    # Responses by Village and Crop
    village_counts = {}
    crop_counts = {}
    
    # Filter calls that have responses
    response_calls = []
    for c in calls:
        if c.summary is not None:
            # For WhatsApp, check it's not a failure error message
            if c.campaign and c.campaign.campaign_type == "WhatsApp Campaign":
                if c.summary.startswith("Twilio credentials") or c.summary.startswith("WhatsApp failed"):
                    continue
            response_calls.append(c)
    
    for call in response_calls:
        farmer = call.farmer
        if farmer:
            v = farmer.village or "Unknown"
            c = farmer.crop or "Unknown"
            village_counts[v] = village_counts.get(v, 0) + 1
            crop_counts[c] = crop_counts.get(c, 0) + 1
            
    village_dist = [{"name": k, "value": v} for k, v in village_counts.items()]
    crop_dist = [{"name": k, "value": v} for k, v in crop_counts.items()]
    
    # Performance trend (responses by date)
    trend_counts = {}
    for call in response_calls:
        date_str = call.created_at.strftime("%Y-%m-%d")
        trend_counts[date_str] = trend_counts.get(date_str, 0) + 1
    
    performance_trend = [{"date": k, "responses": v} for k, v in sorted(trend_counts.items())]
    
    return {
        "status_distribution": status_dist,
        "village_distribution": village_dist,
        "crop_distribution": crop_dist,
        "performance_trend": performance_trend
    }

@router.delete("/{campaign_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_campaign(campaign_id: int, db: Session = Depends(get_db)):
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    db.delete(campaign)
    db.commit()
    return None
