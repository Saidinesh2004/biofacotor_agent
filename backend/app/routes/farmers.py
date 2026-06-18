from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from typing import List
import pandas as pd
import io
from app.database import get_db
from app.models.farmer import Farmer
from app.schemas.farmer import FarmerCreate, FarmerUpdate, FarmerResponse

router = APIRouter()

@router.post("/", response_model=FarmerResponse, status_code=status.HTTP_201_CREATED)
def create_farmer(farmer: FarmerCreate, db: Session = Depends(get_db)):
    db_farmer = db.query(Farmer).filter(Farmer.phone == farmer.phone).first()
    if db_farmer:
        raise HTTPException(status_code=400, detail="Phone already registered")
    new_farmer = Farmer(**farmer.model_dump())
    db.add(new_farmer)
    db.commit()
    db.refresh(new_farmer)
    return new_farmer

@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_farmers(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.endswith(('.xlsx', '.xls', '.csv')):
        raise HTTPException(status_code=400, detail="Invalid file format. Please upload an Excel or CSV file.")
    
    try:
        contents = await file.read()
        if file.filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(contents))
        else:
            df = pd.read_excel(io.BytesIO(contents))
        
        # Standardize column names (lowercase and strip spaces)
        df.columns = [str(c).strip().lower() for c in df.columns]
        
        # Map common variations
        col_mapping = {}
        for col in df.columns:
            if 'phone' in col or 'mobile' in col:
                col_mapping[col] = 'phone'
            elif 'name' in col:
                col_mapping[col] = 'name'
            elif 'village' in col:
                col_mapping[col] = 'village'
            elif 'crop' in col:
                col_mapping[col] = 'crop'
            elif 'language' in col:
                col_mapping[col] = 'language'
        
        df = df.rename(columns=col_mapping)
        
        # Required columns mapping
        required_cols = {'name', 'phone', 'village'}
        if not required_cols.issubset(set(df.columns)):
            raise HTTPException(status_code=400, detail=f"Excel must contain these columns: {required_cols}. Found: {list(df.columns)}")
        
        added_count = 0
        skipped_count = 0
        
        # Get existing phones to prevent duplicates quickly
        existing_phones = {f.phone for f in db.query(Farmer.phone).all()}
        
        new_farmers = []
        for index, row in df.iterrows():
            phone = str(row['phone']).strip()
            
            # Simple validation to ensure phone is somewhat valid and not empty or 'nan'
            if phone == 'nan' or not phone:
                continue
                
            if phone in existing_phones:
                skipped_count += 1
                continue
                
            farmer_data = {
                "name": str(row['name']).strip(),
                "phone": phone,
                "village": str(row['village']).strip(),
                "crop": str(row.get('crop', '')).strip() if pd.notna(row.get('crop')) else "Unknown",
                "language": str(row.get('language', '')).strip() if pd.notna(row.get('language')) else "English",
            }
            new_farmers.append(Farmer(**farmer_data))
            existing_phones.add(phone)
            added_count += 1
            
        if new_farmers:
            db.bulk_save_objects(new_farmers)
            db.commit()
            
        return {
            "message": f"Successfully added {added_count} farmers. Skipped {skipped_count} duplicates.",
            "added": added_count,
            "skipped": skipped_count
        }
    except Exception as e:
        print(f"Error parsing Excel: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process Excel file: {str(e)}")

@router.get("/", response_model=List[FarmerResponse])
def get_farmers(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    farmers = db.query(Farmer).offset(skip).limit(limit).all()
    return farmers

@router.get("/{farmer_id}", response_model=FarmerResponse)
def get_farmer(farmer_id: int, db: Session = Depends(get_db)):
    farmer = db.query(Farmer).filter(Farmer.id == farmer_id).first()
    if not farmer:
        raise HTTPException(status_code=404, detail="Farmer not found")
    return farmer

@router.put("/{farmer_id}", response_model=FarmerResponse)
def update_farmer(farmer_id: int, farmer_update: FarmerUpdate, db: Session = Depends(get_db)):
    farmer = db.query(Farmer).filter(Farmer.id == farmer_id).first()
    if not farmer:
        raise HTTPException(status_code=404, detail="Farmer not found")
    
    update_data = farmer_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(farmer, key, value)
    
    db.commit()
    db.refresh(farmer)
    return farmer

@router.delete("/{farmer_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_farmer(farmer_id: int, db: Session = Depends(get_db)):
    from app.models.voice_call import VoiceCall
    from app.models.conversation_log import ConversationLog
    from app.models.whatsapp_message import WhatsAppMessage
    from app.models.campaign import CampaignCall, CampaignFarmer

    farmer = db.query(Farmer).filter(Farmer.id == farmer_id).first()
    if not farmer:
        raise HTTPException(status_code=404, detail="Farmer not found")
    
    # Cascade delete all related records in other tables
    db.query(VoiceCall).filter(VoiceCall.farmer_id == farmer_id).delete(synchronize_session=False)
    db.query(ConversationLog).filter(ConversationLog.farmer_id == farmer_id).delete(synchronize_session=False)
    db.query(WhatsAppMessage).filter(WhatsAppMessage.farmer_id == farmer_id).delete(synchronize_session=False)
    db.query(CampaignCall).filter(CampaignCall.farmer_id == farmer_id).delete(synchronize_session=False)
    db.query(CampaignFarmer).filter(CampaignFarmer.farmer_id == farmer_id).delete(synchronize_session=False)
    
    db.delete(farmer)
    db.commit()
    return None
