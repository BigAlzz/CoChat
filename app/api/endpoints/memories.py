from fastapi import APIRouter, HTTPException
from typing import List, Dict, Optional
from app.core.memory_store import MemoryStore
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()
memory_store = MemoryStore()

@router.post("/", response_model=Dict)
async def create_memory(content: str, metadata: Optional[Dict] = None):
    """Create a new memory."""
    try:
        return memory_store.store_memory(content, metadata)
    except Exception as e:
        logger.error(f"Error creating memory: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/", response_model=List[Dict])
async def list_memories(query: Optional[str] = None, limit: int = 5):
    """List memories, optionally filtered by a search query."""
    try:
        return memory_store.get_memories(query, limit)
    except Exception as e:
        logger.error(f"Error listing memories: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{memory_id}", response_model=Dict)
async def get_memory(memory_id: str):
    """Get a specific memory by ID."""
    memory = memory_store.get_memory(memory_id)
    if not memory:
        raise HTTPException(status_code=404, detail="Memory not found")
    return memory

@router.delete("/{memory_id}")
async def delete_memory(memory_id: str):
    """Delete a specific memory by ID."""
    if memory_store.delete_memory(memory_id):
        return {"status": "success"}
    raise HTTPException(status_code=404, detail="Memory not found") 