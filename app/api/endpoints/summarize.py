from fastapi import APIRouter, HTTPException, Depends
from typing import List, Dict, Optional
from pydantic import BaseModel
from app.services.lm_studio import LMStudioService, lmstudio_service
from fastapi.responses import StreamingResponse
import json
import asyncio

router = APIRouter()

class Message(BaseModel):
    role: str
    content: str
    assistant: Optional[str] = None
    timestamp: Optional[str] = None

class PanelConversation(BaseModel):
    panelIndex: int
    messages: List[Message]

class SummarizeRequest(BaseModel):
    conversations: List[PanelConversation]
    type: str
    systemPrompt: str
    modelId: str

async def get_lm_studio_service() -> LMStudioService:
    return lmstudio_service

@router.post("/summarize")
async def summarize_conversation(
    request: SummarizeRequest,
    lm_studio: LMStudioService = Depends(get_lm_studio_service),
) -> StreamingResponse:
    async def generate():
        try:
            # Verify LM Studio is available
            models = await lm_studio.get_available_models()
            if not models:
                yield json.dumps({
                    "error": "No models available. Please ensure LM Studio is running and has models loaded."
                })
                return
            
            # Verify the requested model exists
            if not any(model["id"] == request.modelId for model in models):
                yield json.dumps({
                    "error": f"Model {request.modelId} not found in available models"
                })
                return
            
            # Format the conversation history for the LLM
            formatted_history = []
            
            # Add system prompt
            formatted_history.append({
                "role": "system",
                "content": request.systemPrompt
            })
            
            # Find the initial question (first user message)
            initial_question = None
            for panel in request.conversations:
                for msg in panel.messages:
                    if msg.role == "user":
                        initial_question = msg.content
                        break
                if initial_question:
                    break

            # Format conversation context with panel sequence
            conversation_context = []
            if initial_question:
                conversation_context.append(f"Initial Question/Prompt:\n{initial_question}\n")

            for panel in sorted(request.conversations, key=lambda x: x.panelIndex):
                panel_context = [f"Panel {panel.panelIndex + 1}:"]
                for msg in panel.messages:
                    role_name = 'User' if msg.role == 'user' else msg.assistant or 'Assistant'
                    panel_context.append(f"{role_name}: {msg.content}")
                conversation_context.append("\n".join(panel_context))

            formatted_history.append({
                "role": "user",
                "content": "Please analyze and summarize the following multi-panel conversation:\n\n" + "\n".join(conversation_context)
            })
            
            # Send progress update
            yield json.dumps({"status": "processing", "message": "Generating summary..."})
            await asyncio.sleep(0.1)  # Small delay to ensure progress message is sent
            
            # Generate summary using the specified model
            summary_stream = lm_studio.generate_response_stream(
                messages=formatted_history,
                model=request.modelId,
                temperature=0.7,
                max_tokens=2000
            )
            
            full_summary = ""
            async for chunk in summary_stream:
                full_summary += chunk
                # Send chunk to client
                yield json.dumps({"chunk": chunk})
                await asyncio.sleep(0.1)  # Small delay to prevent overwhelming the client
            
            # Send completion message
            if full_summary:
                yield json.dumps({"status": "complete", "summary": full_summary})
            else:
                yield json.dumps({
                    "error": "Failed to generate summary. The model did not return a response."
                })
                
        except Exception as e:
            yield json.dumps({
                "error": f"An error occurred while generating the summary: {str(e)}"
            })

    return StreamingResponse(
        generate(),
        media_type="application/x-ndjson"
    ) 