from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional

class AdminProfileBase(BaseModel):
    full_name: str
    phone_number: Optional[str] = None
    email: Optional[EmailStr] = None
    role: str = "Admin"

class AdminProfileUpdate(BaseModel):
    full_name: str
    phone_number: Optional[str] = None
    email: Optional[EmailStr] = None

class AdminProfileResponse(AdminProfileBase):
    id: int
    profile_photo_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
