from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class WhatsAppMessageBase(BaseModel):
    farmer_id: int
    phone: str
    message: str
    status: str

class WhatsAppMessageCreate(WhatsAppMessageBase):
    pass

class WhatsAppMessageResponse(WhatsAppMessageBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True
