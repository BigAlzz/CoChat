from pydantic_settings import BaseSettings
from typing import Optional
from functools import lru_cache

class Settings(BaseSettings):
    # API Configuration
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "RAG API"
    
    # LM Studio Configuration
    LMSTUDIO_BASE_URL: str = "http://192.168.50.89:1234"
    LMSTUDIO_API_KEY: Optional[str] = None
    
    # Security
    SECRET_KEY: str = "your-secret-key-here"  # Change in production
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8  # 8 days
    
    # Database
    CHROMA_DB_PATH: str = "/app/chromadb"
    SQLITE_URL: str = "sqlite:///./cochat.db"
    
    # Chat Configuration
    DEFAULT_MODEL: str = "gpt-3.5-turbo"
    MAX_CONVERSATION_HISTORY: int = 100
    REFRESH_MODELS_INTERVAL: int = 300  # 5 minutes
    
    # Memory Configuration
    MAX_MEMORIES: int = 100
    EMBEDDING_MODEL: str = "all-MiniLM-L6-v2"
    EMBEDDING_DIMENSION: int = 384
    
    # Security
    API_KEY: Optional[str] = None
    OPENAI_API_KEY: Optional[str] = None
    
    LM_STUDIO_BASE_URL: str = "http://192.168.50.89:1234/v1"
    
    class Config:
        case_sensitive = True
        env_file = ".env"
        extra = "allow"  # Allow extra fields from environment variables

@lru_cache()
def get_settings():
    return Settings()

settings = get_settings() 