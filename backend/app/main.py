from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import asyncio
import os
from app.database import engine, Base
from app.routes import admins, farmers, voice_calls, whatsapp, responses, dashboard, campaigns, ws_bridge
from app.scheduler import campaign_scheduler_loop

# Create tables if they don't exist
Base.metadata.create_all(bind=engine)

# Add call_sid column to voice_calls table if not exists (handling migration of existing table)
from sqlalchemy import text
with engine.connect() as connection:
    try:
        connection.execute(text("ALTER TABLE voice_calls ADD COLUMN IF NOT EXISTS call_sid VARCHAR;"))
        connection.commit()
    except Exception as e:
        print(f"Error adding call_sid column to voice_calls: {e}")

# Create static files directory for uploads if not exists
os.makedirs("static", exist_ok=True)

app = FastAPI(title="Biofactor AI Agent API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, replace with specific frontend origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory="static"), name="static")

app.include_router(admins.router, prefix="/admins", tags=["Admins"])
app.include_router(farmers.router, prefix="/farmers", tags=["Farmers"])
app.include_router(voice_calls.router, prefix="/voice-calls", tags=["Voice Calls"])
app.include_router(whatsapp.router, prefix="/whatsapp", tags=["WhatsApp"])
app.include_router(responses.router, prefix="/responses", tags=["Responses"])
app.include_router(dashboard.router, prefix="/dashboard", tags=["Dashboard"])
app.include_router(campaigns.router, prefix="/campaigns", tags=["Campaigns"])
app.include_router(ws_bridge.router, prefix="/ws", tags=["WebSocket Bridge"])

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(campaign_scheduler_loop())

@app.get("/")
def read_root():
    return {"message": "Welcome to Biofactor AI Agent API"}
