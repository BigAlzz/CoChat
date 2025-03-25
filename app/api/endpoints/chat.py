from fastapi import APIRouter, Request, BackgroundTasks, HTTPException, Depends
from fastapi.responses import StreamingResponse
from app.services.lm_studio import LMStudioService
from app.core.config import settings
from app.db.database import get_database
from app.services.lm_studio import lmstudio_service
from app.models.chat import ChatRequest
from typing import List, Dict, Optional
import asyncio
from app.utils.database import get_relevant_memories, store_memory
from app.utils.stream import stream_with_context
from pydantic import BaseModel
from ...core.memory_store import MemoryStore
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()
memory_store = MemoryStore()

async def get_lm_studio_service() -> LMStudioService:
    return lmstudio_service

async def stream_with_context(generator):
    try:
        async for chunk in generator:
            if chunk:
                yield f"data: {chunk}\n\n"
    except Exception as e:
        print(f"Error in stream_with_context: {e}")
        yield f"data: Error: {str(e)}\n\n"
    finally:
        yield "data: [DONE]\n\n"

class ChatRequest(BaseModel):
    messages: List[Dict[str, str]]
    model: str
    temperature: Optional[float] = 0.7
    max_tokens: Optional[int] = 1000
    use_rag: Optional[bool] = False
    query: Optional[str] = None
    store_memory: Optional[bool] = False

@router.post("/completions")
async def chat_completion(request: ChatRequest, background_tasks: BackgroundTasks):
    try:
        # Get RAG context if enabled
        rag_context = None
        if request.use_rag and request.query:
            logger.info(f"Fetching RAG context for query: {request.query}")
            memories = memory_store.get_memories(request.query)
            if memories:
                rag_context = await lmstudio_service.process_rag_context(
                    request.query,
                    memories
                )

        # Generate streaming response
        stream = lmstudio_service.generate_response_stream(
            messages=request.messages,
            model=request.model,
            temperature=request.temperature,
            max_tokens=request.max_tokens,
            rag_context=rag_context
        )

        # Store memory in background if enabled
        if request.store_memory and request.query:
            background_tasks.add_task(
                memory_store.store_memory,
                request.query,
                {"source": "chat", "model": request.model}
            )

        return StreamingResponse(
            stream,
            media_type="text/event-stream"
        )

    except Exception as e:
        logger.error(f"Error in chat completion: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error processing chat request: {str(e)}"
        ) 