from fastapi import APIRouter, HTTPException
from typing import List, Optional
from pydantic import BaseModel
import httpx
import logging
from ....core.config import settings
from ....core.memory_store import MemoryStore

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@router.post("/completions", response_model=ChatResponse)
async def chat_completion(request: ChatRequest):
    """Process chat completion with RAG context"""
    try:
        # Get the last user message
        last_user_message = next(
            (msg for msg in reversed(request.messages) if msg.role == "user"),
            None
        )

        if not last_user_message:
            raise HTTPException(status_code=400, detail="No user message found")

        # Search for relevant memories
        relevant_memories = memory_store.get_memories(last_user_message.content)

        # Format context from memories
        context_str = ""
        if relevant_memories:
            context_str = "Relevant context:\n" + "\n".join(
                f"- {memory['content']}"
                for memory in relevant_memories[:3]
            ) + "\n\nBased on this context, "

        # Prepare messages for LM Studio
        augmented_messages = [
            ChatMessage(role="system", content=(
                "You are a helpful AI assistant. "
                "Use the provided context to inform your responses when relevant."
            ))
        ]

        if context_str:
            augmented_messages.append(ChatMessage(
                role="system",
                content=context_str
            ))

        augmented_messages.extend(request.messages)

        # Forward request to LM Studio
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{settings.LM_STUDIO_BASE_URL}/chat/completions",
                json={
                    "messages": [
                        {"role": msg.role, "content": msg.content}
                        for msg in augmented_messages
                    ],
                    "temperature": request.temperature,
                    "max_tokens": request.max_tokens,
                    "stream": request.stream
                }
            )

            if response.status_code != 200:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"LM Studio error: {response.text}"
                )

            # Log raw response for debugging
            logger.info(f"Raw LM Studio response: {response.text}")
            
            result = response.json()
            logger.info(f"Parsed response: {result}")
            
            assistant_message = result["choices"][0]["message"]

            # Store the assistant's response as a memory
            memory_store.add_memory(
                assistant_message["content"],
                {"type": "assistant_response", "query": last_user_message.content}
            )

            return ChatResponse(
                role=assistant_message["role"],
                content=assistant_message["content"],
                context=[{
                    "content": mem["content"],
                    "timestamp": mem["metadata"]["timestamp"]
                } for mem in relevant_memories[:3]] if relevant_memories else None
            )

    except Exception as e:
        logger.error(f"Error in chat completion: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to process chat completion: {str(e)}"
        ) 