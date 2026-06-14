from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class ConversationLog(Base):
    __tablename__ = "conversation_logs"

    id = Column(Integer, primary_key=True, index=True)
    farmer_id = Column(Integer, ForeignKey("farmers.id"))
    farmer_name = Column(String)
    phone_number = Column(String, index=True)
    call_sid = Column(String, index=True, nullable=True)
    elevenlabs_conversation_id = Column(String, index=True, nullable=True)
    call_status = Column(String)
    call_duration = Column(Integer, nullable=True)
    conversation_summary = Column(String, nullable=True)
    farmer_responses = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    farmer = relationship("Farmer")
