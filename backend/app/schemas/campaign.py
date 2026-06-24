from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional

class CampaignBase(BaseModel):
    campaign_name: str
    description: Optional[str] = None
    campaign_type: str
    scheduled_at: Optional[datetime] = None
    status: str = "Draft"
    created_by: Optional[str] = None

class CampaignCreate(CampaignBase):
    farmer_ids: List[int] = []

class CampaignResponse(CampaignBase):
    id: int
    created_at: datetime
    farmers_count: int = 0

    class Config:
        from_attributes = True

class CampaignFarmerResponse(BaseModel):
    id: int
    name: str
    phone: str
    village: str
    crop: str
    language: str

    class Config:
        from_attributes = True

class CampaignDetailResponse(CampaignResponse):
    farmers: List[CampaignFarmerResponse] = []

    class Config:
        from_attributes = True

class CampaignCallResponse(BaseModel):
    id: int
    campaign_id: int
    farmer_id: int
    farmer_name: str
    phone_number: str
    twilio_call_sid: Optional[str] = None
    elevenlabs_conversation_id: Optional[str] = None
    call_status: str
    duration: Optional[int] = None
    transcript: Optional[str] = None
    summary: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class CampaignSummaryStats(BaseModel):
    campaign_name: str
    scheduled_at: Optional[datetime] = None
    farmers_targeted: int
    farmers_reached: int
    calls_answered: int
    calls_failed: int
    responses_collected: int
    average_duration: float
    success_rate: float

class CampaignAIRequest(BaseModel):
    raw_text: str

class CampaignAIResponse(BaseModel):
    polished_message: str
    suggested_name: str
    detected_crop: Optional[str] = None
    suggested_date: Optional[str] = None

