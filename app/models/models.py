from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, JSON, Boolean, Text
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    conversations = relationship("Conversation", back_populates="user")
    settings = relationship("UserSettings", back_populates="user", uselist=False)

class Conversation(Base):
    __tablename__ = "conversations"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String)
    user_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_autonomous = Column(Boolean, default=False)
    mode = Column(String, default="individual")
    panels = Column(JSON, nullable=True)
    
    user = relationship("User", back_populates="conversations")
    messages = relationship("Message", back_populates="conversation")
    assistants = relationship("ConversationAssistant", back_populates="conversation")

class Message(Base):
    __tablename__ = "messages"
    
    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"))
    content = Column(Text)
    role = Column(String)  # user, assistant, system
    assistant_id = Column(Integer, ForeignKey("conversation_assistants.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    message_metadata = Column(JSON, nullable=True)  # For storing additional message data
    
    conversation = relationship("Conversation", back_populates="messages")
    assistant = relationship("ConversationAssistant", back_populates="messages")

class ConversationAssistant(Base):
    __tablename__ = "conversation_assistants"
    
    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"))
    name = Column(String)
    model = Column(String)
    role = Column(String)  # The role/personality of the assistant
    posture = Column(String)  # The conversation style/approach
    system_prompt = Column(Text)
    order = Column(Integer)  # For sequential conversations
    
    conversation = relationship("Conversation", back_populates="assistants")
    messages = relationship("Message", back_populates="assistant")

class UserSettings(Base):
    __tablename__ = "user_settings"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    theme = Column(String, default="dark")
    default_model = Column(String)
    interface_settings = Column(JSON)  # For storing UI preferences
    
    user = relationship("User", back_populates="settings") 