from typing import List, Dict, Any
from sqlalchemy import text
from app.db.database import get_database

async def get_relevant_memories(query: str, limit: int = 5) -> List[Dict[str, Any]]:
    """Get relevant memories based on the query."""
    async for db in get_database():
        try:
            # Using SQLite FTS5 for full-text search if available, otherwise basic LIKE query
            sql = text("""
                SELECT * FROM memories 
                WHERE content LIKE :query 
                ORDER BY created_at DESC 
                LIMIT :limit
            """)
            result = db.execute(sql, {"query": f"%{query}%", "limit": limit})
            memories = [dict(row) for row in result]
            return memories
        except Exception as e:
            print(f"Error retrieving memories: {e}")
            return []

async def store_memory(content: Dict[str, Any]) -> bool:
    """Store a new memory."""
    async for db in get_database():
        try:
            sql = text("""
                INSERT INTO memories (content, created_at) 
                VALUES (:content, CURRENT_TIMESTAMP)
            """)
            db.execute(sql, {"content": str(content)})
            db.commit()
            return True
        except Exception as e:
            print(f"Error storing memory: {e}")
            db.rollback()
            return False 