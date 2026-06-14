from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class Farmer(Base):
    __tablename__ = "farmers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    phone = Column(String, index=True, unique=True)
    village = Column(String)
    crop = Column(String)
    language = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    voice_calls = relationship("VoiceCall", back_populates="farmer")
    whatsapp_messages = relationship("WhatsAppMessage", back_populates="farmer")
