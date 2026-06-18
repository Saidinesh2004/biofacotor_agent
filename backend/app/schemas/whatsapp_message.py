from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class WhatsAppMessageBase(BaseModel):
    farmer_id: Optional[int] = None
    phone: str
    message: str

class WhatsAppMessageCreate(WhatsAppMessageBase):
    pass

class WhatsAppMessageResponse(WhatsAppMessageBase):
    id: int
    status: str
    created_at: datetime

    class Config:
        from_attributes = True
