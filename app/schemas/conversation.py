from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import datetime

class MessageBase(BaseModel):
    content: str
    role: str = "user"

class MessageCreate(MessageBase):
    pass

class Message(MessageBase):
    id: int
    conversation_id: int
    assistant_id: Optional[int] = None
    created_at: datetime
    metadata: Optional[Dict] = None

    class Config:
        from_attributes = True

class ConversationAssistantBase(BaseModel):
    name: str
    model: str
    role: str
    posture: str
    system_prompt: Optional[str] = None
    order: Optional[int] = None

class ConversationAssistantCreate(ConversationAssistantBase):
    pass

class ConversationAssistant(ConversationAssistantBase):
    id: int
    conversation_id: int

    class Config:
        from_attributes = True

class ConversationBase(BaseModel):
    title: str
    is_autonomous: bool = False
    mode: str = "individual"
    panels: Optional[List[Dict]] = None

class ConversationCreate(ConversationBase):
    user_id: int

class Conversation(ConversationBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime
    messages: List[Message] = []
    assistants: List[ConversationAssistant] = []

    class Config:
        from_attributes = True

class UserSettingsBase(BaseModel):
    theme: str = "dark"
    default_model: Optional[str] = None
    interface_settings: Optional[Dict] = None

class UserSettingsCreate(UserSettingsBase):
    user_id: int

class UserSettings(UserSettingsBase):
    id: int
    user_id: int

    class Config:
        from_attributes = True

class Model(BaseModel):
    id: str
    name: str 