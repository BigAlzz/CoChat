import chromadb
from chromadb.config import Settings
import uuid
from datetime import datetime
import logging
import os
from typing import List, Dict, Optional

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class MemoryStore:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(MemoryStore, cls).__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
            
        try:
            logger.info("Initializing ChromaDB with local persistent storage")
            
            # Use local persistent storage
            self.client = chromadb.PersistentClient(
                path="./chroma_db"
            )
            
            # Create or get the collection
            self.collection = self.client.get_or_create_collection(
                name="memories",
                metadata={"hnsw:space": "cosine"}
            )
            
            self._initialized = True
            logger.info("ChromaDB initialized successfully")
            
        except Exception as e:
            logger.error(f"Error initializing memory store: {e}")
            # Create an empty in-memory fallback
            self.client = None
            self.collection = None

    def store_memory(self, content: str, metadata: Optional[Dict] = None) -> Dict:
        """Store a new memory and return the created memory object"""
        try:
            memory_id = str(uuid.uuid4())
            
            # Ensure metadata is a dictionary
            if metadata is None:
                metadata = {}
            
            # Add timestamp if not present
            if "timestamp" not in metadata:
                metadata["timestamp"] = datetime.utcnow().isoformat()

            # Add to ChromaDB
            self.collection.add(
                documents=[content],
                metadatas=[metadata],
                ids=[memory_id]
            )
            
            logger.info(f"Memory stored successfully: {memory_id}")
            
            # Return the created memory object
            return {
                "id": memory_id,
                "content": content,
                "metadata": metadata,
                "created_at": metadata["timestamp"]
            }
        except Exception as e:
            logger.error(f"Error storing memory: {e}")
            raise

    def get_memories(self, query: Optional[str] = None, limit: int = 5) -> List[Dict]:
        try:
            if query:
                # Search by similarity if query provided
                results = self.collection.query(
                    query_texts=[query],
                    n_results=limit
                )
                
                if not results or not results['ids']:
                    logger.info("No memories found for query")
                    return []
                
                # Format results
                memories = []
                for i, memory_id in enumerate(results['ids'][0]):
                    memories.append({
                        "id": memory_id,
                        "content": results['documents'][0][i],
                        "metadata": results['metadatas'][0][i] if results['metadatas'] else {}
                    })
                
                logger.info(f"Retrieved {len(memories)} memories for query")
                return memories
            else:
                # Get all memories if no query
                results = self.collection.get()
                
                if not results or not results['ids']:
                    logger.info("No memories found")
                    return []
                
                # Format results
                memories = []
                for i, memory_id in enumerate(results['ids']):
                    memories.append({
                        "id": memory_id,
                        "content": results['documents'][i],
                        "metadata": results['metadatas'][i] if results['metadatas'] else {}
                    })
                
                logger.info(f"Retrieved {len(memories)} total memories")
                return memories
        except Exception as e:
            logger.error(f"Error retrieving memories: {e}")
            return []

    def get_memory(self, memory_id: str) -> Optional[Dict]:
        try:
            result = self.collection.get(ids=[memory_id])
            
            if not result or not result['ids']:
                logger.info(f"Memory not found: {memory_id}")
                return None
            
            return {
                "id": memory_id,
                "content": result['documents'][0],
                "metadata": result['metadatas'][0] if result['metadatas'] else {}
            }
        except Exception as e:
            logger.error(f"Error retrieving memory {memory_id}: {e}")
            return None

    def delete_memory(self, memory_id: str) -> bool:
        try:
            self.collection.delete(ids=[memory_id])
            logger.info(f"Memory deleted: {memory_id}")
            return True
        except Exception as e:
            logger.error(f"Error deleting memory {memory_id}: {e}")
            return False 