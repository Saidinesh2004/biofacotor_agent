from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime

class ConversationLogCreate(BaseModel):
    farmer_id: int
    farmer_name: str
    phone_number: str
    call_sid: Optional[str] = None
    elevenlabs_conversation_id: Optional[str] = None
    call_status: str
    call_duration: Optional[int] = None
    conversation_summary: Optional[str] = None
    farmer_responses: Optional[Any] = None

class ConversationLogResponse(ConversationLogCreate):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True
