import httpx
from typing import List, Dict, Optional, AsyncGenerator
from app.core.config import settings
import asyncio
import json

class LMStudioService:
    def __init__(self):
        self.base_url = settings.LMSTUDIO_BASE_URL
        self.api_key = settings.LMSTUDIO_API_KEY
        self._available_models = []
        self._last_models_update = 0
        self._default_model = None  # Store the first available model as default

    async def get_available_models(self, force_refresh: bool = False) -> List[Dict]:
        """Fetch available models from LM Studio."""
        try:
            async with httpx.AsyncClient(timeout=300.0) as client:
                response = await client.get(f"{self.base_url}/v1/models")
                response.raise_for_status()
                data = response.json()
                models = data["data"] if isinstance(data, dict) and "data" in data else data
                
                # Store the first model as default if available
                if models and len(models) > 0:
                    self._default_model = models[0]["id"]
                
                return models
        except Exception as e:
            print(f"Warning: Could not connect to LM Studio: {e}")
            return []

    async def ensure_model_specified(self, payload: Dict) -> Dict:
        """Ensure the model is specified in the request payload."""
        if "model" not in payload or not payload["model"]:
            # If no model specified, try to use default or fetch available models
            if not self._default_model:
                models = await self.get_available_models(force_refresh=True)
                if models:
                    self._default_model = models[0]["id"]
            
            if self._default_model:
                payload["model"] = self._default_model
            else:
                raise ValueError("No model specified and no default model available")
        
        return payload

    async def generate_response_stream(
        self,
        messages: List[Dict],
        model: str,
        temperature: float = 0.7,
        max_tokens: int = 1000,
    ) -> AsyncGenerator[str, None]:
        """Generate a streaming response from the LLM model."""
        try:
            async with httpx.AsyncClient(timeout=300.0) as client:
                payload = {
                    "messages": messages,
                    "model": model,
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                    "stream": True
                }
                
                # Ensure model is specified
                payload = await self.ensure_model_specified(payload)
                
                headers = {}
                if self.api_key:
                    headers["Authorization"] = f"Bearer {self.api_key}"
                
                async with client.stream(
                    "POST",
                    f"{self.base_url}/v1/chat/completions",
                    json=payload,
                    headers=headers,
                ) as response:
                    response.raise_for_status()
                    buffer = ""
                    async for chunk in response.aiter_lines():
                        if chunk.startswith("data: "):
                            chunk = chunk[6:]  # Remove "data: " prefix
                            if chunk.strip() == "[DONE]":
                                break
                            try:
                                data = json.loads(chunk)
                                if data.get("choices") and len(data["choices"]) > 0:
                                    delta = data["choices"][0].get("delta", {})
                                    if "content" in delta:
                                        content = delta["content"]
                                        buffer += content
                                        yield content
                            except json.JSONDecodeError:
                                continue
                    
                    if buffer:  # Return any remaining buffered content
                        yield buffer

        except Exception as e:
            print(f"Error generating streaming response: {e}")
            yield f"Error: {str(e)}"

    async def generate_response(
        self,
        messages: List[Dict],
        model: str,
        temperature: float = 0.7,
        max_tokens: int = 1000,
    ) -> Optional[str]:
        """Generate a complete response from the LLM model."""
        try:
            full_response = ""
            async for chunk in self.generate_response_stream(
                messages=messages,
                model=model,
                temperature=temperature,
                max_tokens=max_tokens,
            ):
                full_response += chunk
            return full_response
        except Exception as e:
            print(f"Error generating response: {e}")
            return None

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