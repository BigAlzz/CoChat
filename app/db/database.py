from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

# SQLite setup
SQLALCHEMY_DATABASE_URL = settings.SQLITE_URL
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

async def get_database():
    """Get database connection."""
    try:
        db = SessionLocal()
        yield db
    finally:
        db.close() 