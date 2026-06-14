from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List
from app.database import get_db
from app.models.conversation_log import ConversationLog
from app.schemas.conversation_log import ConversationLogResponse

router = APIRouter()

@router.get("/", response_model=List[ConversationLogResponse])
def get_responses(
    skip: int = 0, 
    limit: int = 100, 
    search: str = None,
    db: Session = Depends(get_db)
):
    query = db.query(ConversationLog)
    
    if search:
        query = query.filter(
            (ConversationLog.farmer_name.ilike(f"%{search}%")) |
            (ConversationLog.phone_number.ilike(f"%{search}%")) |
            (ConversationLog.conversation_summary.ilike(f"%{search}%"))
        )
        
    responses = query.order_by(desc(ConversationLog.created_at)).offset(skip).limit(limit).all()
    return responses
