from pydantic import BaseModel
from typing import Optional, Dict
from datetime import datetime

class MemoryBase(BaseModel):
    content: str
    metadata: Optional[Dict] = None

class MemoryCreate(MemoryBase):
    pass

class MemoryResponse(MemoryBase):
    id: str
    created_at: datetime = datetime.utcnow()

    class Config:
        from_attributes = True 