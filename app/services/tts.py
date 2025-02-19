import os
import logging
from typing import List, Dict, Any
from pathlib import Path
from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel
import tempfile
import uuid
import win32com.client

logger = logging.getLogger(__name__)

# Configure logging
logging.basicConfig(level=logging.INFO)

# Create router
router = APIRouter()

# Initialize Windows SAPI
try:
    speaker = win32com.client.Dispatch("SAPI.SpVoice")
    stream = win32com.client.Dispatch("SAPI.SpFileStream")
    logger.info("Windows SAPI initialized successfully")
except Exception as e:
    logger.error(f"Failed to initialize Windows SAPI: {e}")
    speaker = None
    stream = None

class TTSRequest(BaseModel):
    text: str
    voice: str = None

class TTSResponse(BaseModel):
    status: str
    message: str
    audio_path: str = None

@router.get("/voices")
async def list_voices() -> List[Dict[str, Any]]:
    """Get list of available Windows SAPI voices."""
    try:
        voices = []
        
        # Get Windows SAPI voices
        if speaker:
            for voice in speaker.GetVoices():
                voice_id = voice.Id
                voice_name = voice.GetDescription()
                voices.append({
                    "id": voice_id,
                    "name": voice_name,
                    "description": f"Windows SAPI voice - {voice_name}",
                    "isDefault": True
                })
        
        logger.info(f"Found {len(voices)} voices")
        return voices
    except Exception as e:
        logger.error(f"Error listing voices: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/speak")
async def speak(request: TTSRequest) -> Response:
    """Convert text to speech using Windows SAPI."""
    try:
        if not speaker:
            raise HTTPException(status_code=500, detail="Windows TTS service not available")

        # Create a temporary file for the audio output
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_file:
            output_path = temp_file.name

        try:
            # Configure the audio stream
            stream.Open(output_path, 3)  # 3 = SSFMCreateForWrite
            speaker.AudioOutputStream = stream

            # Set the voice if specified
            if request.voice:
                logger.info(f"Setting Windows SAPI voice to: {request.voice}")
                voices = speaker.GetVoices()
                voice_set = False
                for voice in voices:
                    if voice.Id == request.voice:
                        logger.info(f"Found matching voice: {voice.GetDescription()}")
                        speaker.Voice = voice
                        voice_set = True
                        break
                if not voice_set:
                    logger.warning(f"Voice {request.voice} not found, using default voice")

            # Generate speech
            speaker.Speak(request.text)
            stream.Close()

            # Read the generated audio file
            with open(output_path, 'rb') as audio_file:
                audio_data = audio_file.read()

            # Clean up the temporary file
            os.unlink(output_path)

            # Return the audio data with appropriate headers
            return Response(
                content=audio_data,
                media_type="audio/wav",
                headers={
                    "Content-Disposition": f'attachment; filename="speech_{uuid.uuid4()}.wav"'
                }
            )

        except Exception as e:
            logger.error(f"Error generating speech: {e}")
            if os.path.exists(output_path):
                os.unlink(output_path)
            raise HTTPException(status_code=500, detail=str(e))

    except Exception as e:
        logger.error(f"Error in TTS: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/download/{filename}")
async def download_audio(filename: str):
    """Download generated audio file."""
    try:
        file_path = Path("temp") / filename
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="Audio file not found")

        with open(file_path, 'rb') as audio_file:
            audio_data = audio_file.read()

        return Response(
            content=audio_data,
            media_type="audio/wav",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"'
            }
        )
    except Exception as e:
        logger.error(f"Error downloading audio: {e}")
        raise HTTPException(status_code=500, detail=str(e))