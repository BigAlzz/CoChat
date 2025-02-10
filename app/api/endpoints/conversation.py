from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.database import get_db
from app.services.lmstudio import lmstudio_service
from app.models import models
from app.schemas import conversation as schemas
import asyncio

router = APIRouter()

@router.get("/models")
async def get_available_models():
    """Get list of available models from LM Studio."""
    models = await lmstudio_service.get_available_models()
    return {"data": models}  # Wrap in data field to match LMStudioResponse format

@router.post("/conversations", response_model=schemas.Conversation)
async def create_conversation(
    conversation: schemas.ConversationCreate,
    db: Session = Depends(get_db)
):
    """Create a new conversation."""
    db_conversation = models.Conversation(
        title=conversation.title,
        user_id=conversation.user_id,
        is_autonomous=conversation.is_autonomous
    )
    db.add(db_conversation)
    db.commit()
    db.refresh(db_conversation)
    return db_conversation

@router.post("/conversations/{conversation_id}/assistants")
async def add_assistant(
    conversation_id: int,
    assistant: schemas.ConversationAssistantCreate,
    db: Session = Depends(get_db)
):
    """Add an assistant to a conversation."""
    db_assistant = models.ConversationAssistant(
        conversation_id=conversation_id,
        name=assistant.name,
        model=assistant.model,
        role=assistant.role,
        posture=assistant.posture,
        system_prompt=assistant.system_prompt,
        order=assistant.order
    )
    db.add(db_assistant)
    db.commit()
    db.refresh(db_assistant)
    return db_assistant

@router.post("/conversations/{conversation_id}/messages")
async def create_message(
    conversation_id: int,
    message: schemas.MessageCreate,
    db: Session = Depends(get_db)
):
    """Create a new message and process it through the conversation flow."""
    # Get conversation and its assistants
    conversation = db.query(models.Conversation).filter(
        models.Conversation.id == conversation_id
    ).first()
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    assistants = db.query(models.ConversationAssistant).filter(
        models.ConversationAssistant.conversation_id == conversation_id
    ).order_by(models.ConversationAssistant.order).all()
    
    if not assistants:
        raise HTTPException(status_code=400, detail="No assistants configured for this conversation")
    
    # Save user message
    db_message = models.Message(
        conversation_id=conversation_id,
        content=message.content,
        role="user"
    )
    db.add(db_message)
    db.commit()
    
    # Process message through assistants
    assistant_configs = [
        {
            "name": assistant.name,
            "model": assistant.model,
            "system_prompt": assistant.system_prompt,
            "role": assistant.role,
            "posture": assistant.posture
        }
        for assistant in assistants
    ]
    
    if conversation.is_autonomous:
        responses = await lmstudio_service.process_parallel_conversation(
            message=message.content,
            assistants=assistant_configs
        )
    else:
        responses = await lmstudio_service.process_sequential_conversation(
            initial_message=message.content,
            assistants=assistant_configs
        )
    
    # Save assistant responses
    saved_messages = [db_message]
    for response in responses:
        if response["role"] == "assistant":
            assistant = next(
                (a for a in assistants if a.name == response["assistant_name"]),
                None
            )
            if assistant:
                db_response = models.Message(
                    conversation_id=conversation_id,
                    content=response["content"],
                    role="assistant",
                    assistant_id=assistant.id
                )
                db.add(db_response)
                saved_messages.append(db_response)
    
    db.commit()
    return saved_messages

@router.get("/conversations/{conversation_id}/messages", response_model=List[schemas.Message])
def get_conversation_messages(
    conversation_id: int,
    db: Session = Depends(get_db)
):
    """Get all messages in a conversation."""
    messages = db.query(models.Message).filter(
        models.Message.conversation_id == conversation_id
    ).order_by(models.Message.created_at).all()
    return messages

@router.get("/conversations/{conversation_id}/summary")
async def get_conversation_summary(
    conversation_id: int,
    db: Session = Depends(get_db)
):
    """Generate a summary of the conversation."""
    messages = db.query(models.Message).filter(
        models.Message.conversation_id == conversation_id
    ).order_by(models.Message.created_at).all()
    
    if not messages:
        raise HTTPException(status_code=404, detail="No messages found")
    
    # Prepare conversation history for summarization
    conversation_text = "\n".join([
        f"{message.role}: {message.content}"
        for message in messages
    ])
    
    summary_prompt = f"""Please provide a concise summary of the following conversation:
    
{conversation_text}

Summary:"""
    
    summary = await lmstudio_service.generate_response(
        messages=[{"role": "user", "content": summary_prompt}],
        model="gpt-3.5-turbo",  # Use a default model for summarization
        max_tokens=250
    )
    
    return {"summary": summary}

@router.post("/models")
async def add_model(model: schemas.Model):
    """Add a new model to LM Studio."""
    try:
        await lmstudio_service.add_model({
            "id": model.id,
            "name": model.name,
            "object": "model",
            "owned_by": "organization_owner"
        })
        return {"message": "Model added successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/models/{model_id}")
async def remove_model(model_id: str):
    """Remove a model from LM Studio."""
    try:
        await lmstudio_service.remove_model(model_id)
        return {"message": "Model removed successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/models/{model_id}")
async def update_model(model_id: str, model: schemas.Model):
    """Update a model in LM Studio."""
    try:
        # First remove the old model
        await lmstudio_service.remove_model(model_id)
        # Then add the updated model
        await lmstudio_service.add_model({
            "id": model.id,
            "name": model.name,
            "object": "model",
            "owned_by": "organization_owner"
        })
        return {"message": "Model updated successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) 