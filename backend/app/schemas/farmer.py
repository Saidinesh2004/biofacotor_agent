from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class FarmerBase(BaseModel):
    name: str
    phone: str
    village: Optional[str] = None
    crop: Optional[str] = None
    language: Optional[str] = None

class FarmerCreate(FarmerBase):
    pass

class FarmerUpdate(FarmerBase):
    pass

class FarmerResponse(FarmerBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True
