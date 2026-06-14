from fastapi import APIRouter, Depends, status, HTTPException
from sqlalchemy.orm import Session
from typing import List
import os
from twilio.rest import Client
from app.database import get_db
from app.models.whatsapp_message import WhatsAppMessage
from app.schemas.whatsapp_message import WhatsAppMessageCreate, WhatsAppMessageResponse

router = APIRouter()

# Initialize Twilio Client
twilio_client = Client(
    os.getenv("TWILIO_ACCOUNT_SID"), 
    os.getenv("TWILIO_AUTH_TOKEN")
)

@router.post("/send", response_model=WhatsAppMessageResponse, status_code=status.HTTP_201_CREATED)
def send_whatsapp_message(message: WhatsAppMessageCreate, db: Session = Depends(get_db)):
    try:
        # Send message via Twilio
        twilio_number = os.getenv("TWILIO_WHATSAPP_NUMBER")
        
        # Ensure the recipient phone number starts with the country code (e.g., +1)
        recipient_phone = message.phone if message.phone.startswith("+") else f"+{message.phone}"
        
        twilio_response = twilio_client.messages.create(
            from_=f"whatsapp:{twilio_number}",
            body=message.message,
            to=f"whatsapp:{recipient_phone}"
        )
        
        # Update status based on Twilio response
        final_status = "Sent" if twilio_response.sid else "Failed"
        
        # Save to database
        db_message_data = message.model_dump()
        db_message_data["status"] = final_status
        new_message = WhatsAppMessage(**db_message_data)
        
        db.add(new_message)
        db.commit()
        db.refresh(new_message)
        return new_message
    except Exception as e:
        print(f"Twilio Error: {e}")
        # Save failed attempt
        db_message_data = message.model_dump()
        db_message_data["status"] = "Failed"
        new_message = WhatsAppMessage(**db_message_data)
        db.add(new_message)
        db.commit()
        db.refresh(new_message)
        raise HTTPException(status_code=500, detail=f"Failed to send WhatsApp message: {str(e)}")

@router.get("/history", response_model=List[WhatsAppMessageResponse])
def get_whatsapp_history(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    messages = db.query(WhatsAppMessage).offset(skip).limit(limit).all()
    return messages
