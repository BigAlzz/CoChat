import httpx
from typing import List, Dict, Optional
from ..core.config import settings
import asyncio
import json

class LMStudioService:
    def __init__(self):
        self.base_url = settings.LMSTUDIO_BASE_URL
        self.api_key = settings.LMSTUDIO_API_KEY
        self._available_models = []
        self._last_models_update = 0

    async def get_available_models(self, force_refresh: bool = False) -> List[Dict]:
        """Fetch available models from LM Studio."""
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:  # Increased timeout to 120 seconds
                response = await client.get(f"{self.base_url}/v1/models")
                response.raise_for_status()
                data = response.json()
                if isinstance(data, dict) and "data" in data:
                    return data["data"]
                return data  # If it's already a list
        except Exception as e:
            print(f"Warning: Could not connect to LM Studio: {e}")
            return []

    async def generate_response(
        self,
        messages: List[Dict],
        model: str,
        temperature: float = 0.7,
        max_tokens: int = 1000,
    ) -> Optional[str]:
        """Generate a response from the LLM model."""
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:  # 120 second timeout for generation
                payload = {
                    "messages": messages,
                    "model": model,
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                    "stream": False
                }
                
                headers = {}
                if self.api_key:
                    headers["Authorization"] = f"Bearer {self.api_key}"
                
                response = await client.post(
                    f"{self.base_url}/v1/chat/completions",
                    json=payload,
                    headers=headers,
                )
                response.raise_for_status()
                
                result = response.json()
                if not result or "choices" not in result or not result["choices"]:
                    print("Invalid response format from LM Studio:", result)
                    return None
                    
                choice = result["choices"][0]
                if "message" not in choice or "content" not in choice["message"]:
                    print("Invalid message format from LM Studio:", choice)
                    return None
                    
                return choice["message"]["content"]
        except Exception as e:
            print(f"Error generating response: {e}")
            return None

    async def process_sequential_conversation(
        self,
        initial_message: str,
        assistants: List[Dict],
        system_message: Optional[str] = None,
    ) -> List[Dict]:
        """Process a conversation sequentially through multiple assistants."""
        conversation_history = []
        current_message = initial_message

        if system_message:
            conversation_history.append({"role": "system", "content": system_message})

        conversation_history.append({"role": "user", "content": current_message})

        for assistant in assistants:
            messages = conversation_history.copy()
            if assistant.get("system_prompt"):
                messages.insert(0, {"role": "system", "content": assistant["system_prompt"]})

            response = await self.generate_response(
                messages=messages,
                model=assistant["model"],
            )

            if response:
                conversation_history.append({
                    "role": "assistant",
                    "content": response,
                    "assistant_name": assistant["name"]
                })
                current_message = response
            else:
                break

        return conversation_history

    async def process_parallel_conversation(
        self,
        message: str,
        assistants: List[Dict],
        system_message: Optional[str] = None,
    ) -> List[Dict]:
        """Process a conversation in parallel with multiple assistants."""
        async def get_assistant_response(assistant: Dict, base_messages: List[Dict]):
            messages = base_messages.copy()
            if assistant.get("system_prompt"):
                messages.insert(0, {"role": "system", "content": assistant["system_prompt"]})

            response = await self.generate_response(
                messages=messages,
                model=assistant["model"],
            )

            return {
                "role": "assistant",
                "content": response if response else "Error generating response",
                "assistant_name": assistant["name"]
            }

        base_messages = []
        if system_message:
            base_messages.append({"role": "system", "content": system_message})
        base_messages.append({"role": "user", "content": message})

        tasks = [
            get_assistant_response(assistant, base_messages)
            for assistant in assistants
        ]

        responses = await asyncio.gather(*tasks)
        return base_messages + list(responses)

    async def add_model(self, model: dict) -> None:
        """Add a new model to LM Studio."""
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{self.base_url}/v1/models",
                    json={
                        "id": model["id"],
                        "name": model["name"],
                        "object": model.get("object", "model"),
                        "owned_by": model.get("owned_by", "organization_owner")
                    },
                    headers={"Authorization": f"Bearer {self.api_key}"} if self.api_key else {}
                )
                response.raise_for_status()
                return response.json()
        except Exception as e:
            print(f"Error adding model: {e}")
            raise

    async def remove_model(self, model_id: str) -> None:
        """Remove a model from LM Studio."""
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.delete(
                    f"{self.base_url}/v1/models/{model_id}",
                    headers={"Authorization": f"Bearer {self.api_key}"} if self.api_key else {}
                )
                response.raise_for_status()
        except Exception as e:
            print(f"Error removing model: {e}")
            raise

lmstudio_service = LMStudioService() 