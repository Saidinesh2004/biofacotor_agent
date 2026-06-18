from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class VoiceCallBase(BaseModel):
    farmer_id: int
    phone: str
    status: str = "Initiated"
    call_sid: Optional[str] = None

class VoiceCallCreate(VoiceCallBase):
    pass

class VoiceCallResponse(VoiceCallBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True
