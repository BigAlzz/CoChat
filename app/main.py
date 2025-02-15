from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.core.config import settings
from app.api.endpoints import conversation, memories, chat, summarize, export
from app.services import tts
from app.core.database import engine, Base
from app.core.init_db import init_db
import logging
import os
import json

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create required directories
os.makedirs("app/temp", exist_ok=True)
os.makedirs("static", exist_ok=True)
os.makedirs("voices", exist_ok=True)

# Create all database tables
Base.metadata.create_all(bind=engine)

# Initialize database with default data
init_db()

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(
    conversation.router,
    prefix=f"{settings.API_V1_STR}/conversation",
    tags=["conversation"]
)

app.include_router(
    memories.router,
    prefix=f"{settings.API_V1_STR}/memories",
    tags=["memories"]
)

app.include_router(
    chat.router,
    prefix=f"{settings.API_V1_STR}/chat",
    tags=["chat"]
)

# Add TTS router
app.include_router(
    tts.router,
    prefix=f"{settings.API_V1_STR}/tts",
    tags=["tts"]
)

# Add Summarize router
app.include_router(
    summarize.router,
    prefix=f"{settings.API_V1_STR}/summarize",
    tags=["summarize"]
)

# Add Export router
app.include_router(
    export.router,
    prefix=f"{settings.API_V1_STR}/export",
    tags=["export"]
)

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")
# Mount temp directory for audio files
app.mount("/temp", StaticFiles(directory="app/temp"), name="temp")
# Mount voices directory
app.mount("/voices", StaticFiles(directory="voices"), name="voices")

@app.on_event("startup")
async def startup_event():
    logger.info("Starting up the application...")
    # Create temp directory for audio files if it doesn't exist
    os.makedirs("app/temp", exist_ok=True)
    # Ensure voices directory exists
    os.makedirs("voices", exist_ok=True)
    # Log available voices
    voice_info_path = os.path.join("voices", "voice_info.json")
    if os.path.exists(voice_info_path):
        with open(voice_info_path, 'r') as f:
            voices = json.load(f)
            logger.info(f"Available voices: {list(voices.keys())}")
    else:
        logger.warning("No voice_info.json found in voices directory")

@app.on_event("shutdown")
async def shutdown_event():
    logger.info("Shutting down the application...")
    # Clean up temp audio files
    for file in os.listdir("temp"):
        if file.endswith(".wav"):
            try:
                os.remove(os.path.join("temp", file))
            except Exception as e:
                logger.error(f"Error removing temp file {file}: {e}")

@app.get("/")
async def root():
    return {
        "message": f"Welcome to {settings.PROJECT_NAME}",
        "version": "1.0.0",
        "docs_url": "/docs"
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy"} 