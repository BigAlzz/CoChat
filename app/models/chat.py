from pydantic import BaseModel, Field
from typing import List, Dict, Optional

class ChatRequest(BaseModel):
    messages: List[Dict[str, str]] = Field(
        ...,
        description="List of messages in the conversation"
    )
    model: str = Field(
        ...,
        description="The ID of the model to use for generation"
    )
    temperature: float = Field(
        default=0.7,
        ge=0.0,
        le=2.0,
        description="Sampling temperature to use"
    )
    max_tokens: int = Field(
        default=1000,
        gt=0,
        description="Maximum number of tokens to generate"
    )
    use_rag: bool = Field(
        default=False,
        description="Whether to use RAG (Retrieval Augmented Generation)"
    )
    query: Optional[str] = Field(
        default=None,
        description="The query to use for RAG context retrieval"
    )
    store_memory: bool = Field(
        default=False,
        description="Whether to store the response in memory"
    )
    system_prompt: Optional[str] = Field(
        default=None,
        description="Optional system prompt to prepend to the conversation"
    ) 