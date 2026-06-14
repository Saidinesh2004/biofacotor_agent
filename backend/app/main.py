from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
from app.routes import admins, farmers, voice_calls, whatsapp, responses, dashboard

# Create tables if they don't exist
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Biofactor AI Agent API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, replace with specific frontend origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(admins.router, prefix="/admins", tags=["Admins"])
app.include_router(farmers.router, prefix="/farmers", tags=["Farmers"])
app.include_router(voice_calls.router, prefix="/voice-calls", tags=["Voice Calls"])
app.include_router(whatsapp.router, prefix="/whatsapp", tags=["WhatsApp"])
app.include_router(responses.router, prefix="/responses", tags=["Responses"])
app.include_router(dashboard.router, prefix="/dashboard", tags=["Dashboard"])

@app.get("/")
def read_root():
    return {"message": "Welcome to Biofactor AI Agent API"}
