from fastapi import APIRouter, Depends, status, HTTPException, Request
from sqlalchemy.orm import Session
from typing import List
import os
from twilio.rest import Client
from app.database import get_db
from app.models.whatsapp_message import WhatsAppMessage
from app.schemas.whatsapp_message import WhatsAppMessageCreate, WhatsAppMessageResponse

router = APIRouter()

# Initialize Twilio Client
twilio_sid = os.getenv("TWILIO_ACCOUNT_SID")
twilio_token = os.getenv("TWILIO_AUTH_TOKEN")
twilio_client = Client(twilio_sid, twilio_token) if (twilio_sid and twilio_token) else None

@router.post("/send", response_model=WhatsAppMessageResponse, status_code=status.HTTP_201_CREATED)
def send_whatsapp_message(message: WhatsAppMessageCreate, db: Session = Depends(get_db)):
    try:
        # Send message via Twilio
        twilio_number = os.getenv("TWILIO_WHATSAPP_NUMBER")

        # Ensure the recipient phone number starts with the country code (e.g., +1) and strip spaces
        clean_phone = message.phone.replace(" ", "").replace("-", "")
        recipient_phone = clean_phone if clean_phone.startswith("+") else f"+{clean_phone}"
        
        if not twilio_client:
            raise Exception("Twilio credentials are not configured.")
        
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

@router.post("/webhook")
async def whatsapp_webhook(
    request: Request,
    db: Session = Depends(get_db)
):
    return await handle_webhook_request(request, db)

async def handle_webhook_request(request, db):
    from fastapi.responses import Response
    from app.models.farmer import Farmer
    from app.models.campaign import Campaign, CampaignCall
    
    try:
        form_data = await request.form()
        from_number = form_data.get("From", "") # e.g. "whatsapp:+917780442487"
        body = form_data.get("Body", "")
        
        # Extract clean phone number
        clean_from = from_number.replace("whatsapp:", "").strip()
        
        normalized_from = clean_from.replace(" ", "").replace("-", "")
        if not normalized_from.startswith("+"):
            normalized_from = f"+{normalized_from}"
            
        # Find matching farmer
        farmer = None
        all_farmers = db.query(Farmer).all()
        for f in all_farmers:
            f_phone = (f.phone or "").replace(" ", "").replace("-", "")
            if not f_phone.startswith("+"):
                f_phone = f"+{f_phone}"
            if f_phone == normalized_from:
                farmer = f
                break
                
        if farmer:
            # Save the message with status Received
            new_msg = WhatsAppMessage(
                farmer_id=farmer.id,
                phone=clean_from,
                message=body,
                status="Received"
            )
            db.add(new_msg)
            
            # Find latest WhatsApp campaign call for this farmer
            campaign_call = db.query(CampaignCall).join(Campaign).filter(
                CampaignCall.farmer_id == farmer.id,
                Campaign.campaign_type == "WhatsApp Campaign"
            ).order_by(CampaignCall.id.desc()).first()
            
            if campaign_call:
                # Update response tracking fields
                campaign_call.summary = f"Farmer replied: {body}"
                existing_transcript = campaign_call.transcript or ""
                campaign_call.transcript = f"{existing_transcript}\nFarmer: {body}".strip()
                
            db.commit()
            print(f"WhatsApp reply from {farmer.name} received and logged successfully.")
        else:
            print(f"WhatsApp reply received from unknown number: {clean_from}")
            
    except Exception as e:
        print(f"Error handling WhatsApp webhook: {e}")
        db.rollback()
        
    return Response(content="<Response></Response>", media_type="application/xml")
