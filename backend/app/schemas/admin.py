from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional

class AdminBase(BaseModel):
    name: str
    email: EmailStr

class AdminCreate(AdminBase):
    password: str

class AdminLogin(BaseModel):
    email: EmailStr
    password: str

class AdminResponse(AdminBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True
