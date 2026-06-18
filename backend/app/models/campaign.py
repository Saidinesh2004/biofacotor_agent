from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class Campaign(Base):
    __tablename__ = "campaigns"

    id = Column(Integer, primary_key=True, index=True)
    campaign_name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    campaign_type = Column(String, nullable=False) # Voice Campaign, WhatsApp Campaign, Mixed Campaign
    scheduled_at = Column(DateTime(timezone=True), nullable=True)
    status = Column(String, default="Draft") # Draft, Scheduled, Running, Completed, Failed
    created_by = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    farmers = relationship("Farmer", secondary="campaign_farmers", back_populates="campaigns")
    calls = relationship("CampaignCall", back_populates="campaign", cascade="all, delete-orphan")

class CampaignFarmer(Base):
    __tablename__ = "campaign_farmers"

    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False)
    farmer_id = Column(Integer, ForeignKey("farmers.id", ondelete="CASCADE"), nullable=False)

class CampaignCall(Base):
    __tablename__ = "campaign_calls"

    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False)
    farmer_id = Column(Integer, ForeignKey("farmers.id", ondelete="CASCADE"), nullable=False)
    twilio_call_sid = Column(String, index=True, nullable=True)
    elevenlabs_conversation_id = Column(String, index=True, nullable=True)
    call_status = Column(String, default="Initiated") # Initiated, completed, failed, busy, no-answer, canceled
    duration = Column(Integer, nullable=True)
    transcript = Column(Text, nullable=True)
    summary = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    campaign = relationship("Campaign", back_populates="calls")
    farmer = relationship("Farmer")
