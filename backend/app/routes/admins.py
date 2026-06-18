from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
import os
import shutil

from app.database import get_db
from app.models.admin import Admin
from app.models.admin_profile import AdminProfile
from app.schemas.admin import AdminLogin, AdminResponse
from app.schemas.admin_profile import AdminProfileResponse, AdminProfileUpdate

router = APIRouter()

@router.post("/login", response_model=AdminResponse)
def login_admin(admin_data: AdminLogin, db: Session = Depends(get_db)):
    admin = db.query(Admin).filter(Admin.email == admin_data.email).first()
    if not admin or admin.password != admin_data.password:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    return admin

@router.get("/profile", response_model=AdminProfileResponse)
def get_admin_profile(db: Session = Depends(get_db)):
    profile = db.query(AdminProfile).first()
    if not profile:
        # Seed a default profile using the first Admin
        admin = db.query(Admin).first()
        profile = AdminProfile(
            full_name=admin.name if admin else "Admin User",
            email=admin.email if admin else "admin@biofactor.com",
            phone_number="+919876543210",
            role="Admin"
        )
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return profile

@router.put("/profile", response_model=AdminProfileResponse)
def update_admin_profile(profile_data: AdminProfileUpdate, db: Session = Depends(get_db)):
    profile = db.query(AdminProfile).first()
    if not profile:
        admin = db.query(Admin).first()
        profile = AdminProfile(
            full_name=admin.name if admin else "Admin User",
            email=admin.email if admin else "admin@biofactor.com",
            phone_number="+919876543210",
            role="Admin"
        )
        db.add(profile)
        db.commit()
        db.refresh(profile)
        
    # Phone number validation
    phone = profile_data.phone_number
    if phone:
        digit_count = sum(c.isdigit() for c in phone)
        if digit_count < 6:
            raise HTTPException(status_code=400, detail="Invalid phone number format")

    profile.full_name = profile_data.full_name
    profile.phone_number = profile_data.phone_number
    profile.email = profile_data.email
    
    # Sync core admin
    admin = db.query(Admin).first()
    if admin:
        admin.name = profile_data.full_name
        if profile_data.email:
            admin.email = profile_data.email
            
    db.commit()
    db.refresh(profile)
    return profile

@router.post("/profile/photo", response_model=AdminProfileResponse)
async def upload_profile_photo(file: UploadFile = File(...), db: Session = Depends(get_db)):
    allowed_extensions = {".jpg", ".jpeg", ".png"}
    file_ext = os.path.splitext(file.filename)[1].lower()
    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Unsupported image format. Allowed formats: JPG, JPEG, PNG."
        )

    # Validate file size (limit: 5 MB)
    MAX_FILE_SIZE = 5 * 1024 * 1024
    contents = await file.read()
    file_size = len(contents)
    if file_size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Image size exceeds the 5 MB limit."
        )
        
    # Reset stream cursor
    await file.seek(0)
    
    profile = db.query(AdminProfile).first()
    if not profile:
        admin = db.query(Admin).first()
        profile = AdminProfile(
            full_name=admin.name if admin else "Admin User",
            email=admin.email if admin else "admin@biofactor.com",
            phone_number="+919876543210",
            role="Admin"
        )
        db.add(profile)
        db.commit()
        db.refresh(profile)

    # Save to disk
    filename = f"avatar_{profile.id}{file_ext}"
    filepath = os.path.join("static", filename)
    
    with open(filepath, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    # Update URL
    profile.profile_photo_url = f"/static/{filename}"
    db.commit()
    db.refresh(profile)
    return profile

@router.get("/profile/photo")
def get_profile_photo(db: Session = Depends(get_db)):
    profile = db.query(AdminProfile).first()
    if not profile or not profile.profile_photo_url:
        raise HTTPException(status_code=404, detail="Profile photo not found")
        
    filepath = profile.profile_photo_url.lstrip("/")
    if os.path.exists(filepath):
        return FileResponse(filepath)
    raise HTTPException(status_code=404, detail="Profile photo file not found on disk")
