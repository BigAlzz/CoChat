import axios from 'axios';
import { getSystemPrompt } from '../config/assistantConfig';

const LMSTUDIO_API_URL = 'http://192.168.50.89:1234/v1';

export interface Assistant {
  name: string;
  model: string;
  role: string;
  posture: string;
  system_prompt?: string;
  order?: number;
}

export interface Message {
  id: number;
  content: string;
  role: 'user' | 'assistant';
  assistant_id?: number;
  created_at: string;
  metadata?: Record<string, unknown>;
}

export interface LMStudioResponse {
  data: Array<{
    id: string;
    object: string;
    owned_by: string;
    name?: string;
  }>;
  object: string;
}

export interface Model {
  id: string;
  name: string;
  object?: string;
  owned_by?: string;
}

interface StreamChunk {
  content: string;
  assistant_name: string;
}

// Create API instance
const api = axios.create({
  baseURL: LMSTUDIO_API_URL,
  timeout: 300000, // 300 seconds timeout
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: false
});

// Add response interceptor for better error handling
api.interceptors.response.use(
  response => response,
  error => {
    console.error('API Error:', error);
    if (error.code === 'ECONNABORTED') {
      throw new Error('The model is taking longer than expected to respond. Still waiting for response...');
    }
    if (!error.response) {
      throw new Error('Cannot connect to LM Studio. Please check if it is running and accessible.');
    }
    if (error.response.status === 404) {
      throw new Error('API endpoint not found. Please check if LM Studio is running correctly.');
    }
    throw error;
  }
);

// Model management endpoints
export const getAvailableModels = async (): Promise<LMStudioResponse['data']> => {
  try {
    const response = await api.get<LMStudioResponse>('/models');
    console.log('Models response:', response.data);
    
    if (response.data && response.data.data) {
      return response.data.data;
    }
    throw new Error('Invalid response format from LM Studio');
  } catch (error) {
    console.error('Error fetching models:', error);
    if (error instanceof Error) {
      throw new Error(`Failed to fetch models: ${error.message}`);
    }
    throw error;
  }
};

export const addModel = async (model: Model) => {
  const response = await api.post('/models', {
    id: model.id,
    name: model.name,
    object: 'model',
    owned_by: 'organization_owner'
  });
  return response.data;
};

export const removeModel = async (modelId: string) => {
  const response = await api.delete(`/models/${modelId}`);
  return response.data;
};

export const updateModel = async (model: { id: string; name: string; oldId: string }) => {
  try {
    // First remove the old model
    await removeModel(model.oldId);
    // Then add the updated model
    return await addModel({
      id: model.id,
      name: model.name,
      object: 'model',
      owned_by: 'organization_owner'
    });
  } catch (error) {
    console.error('Error updating model:', error);
    throw error;
  }
};

// Chat completion endpoint
export const sendMessage = async (
  modelId: string,
  content: string,
  role: string,
  posture: string,
  onChunk?: (chunk: StreamChunk) => void
) => {
  const systemPrompt = getSystemPrompt(role, posture);
  
  if (onChunk) {
    // Use streaming endpoint
    const response = await fetch(
      `${LMSTUDIO_API_URL}/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content }
          ],
          model: modelId,
          temperature: 0.7,
          max_tokens: 1000,
          stream: true
        })
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    if (!reader) {
      throw new Error('No response body reader available');
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(5);
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            if (parsed.choices?.[0]?.delta?.content) {
              onChunk({
                content: parsed.choices[0].delta.content,
                assistant_name: `${role.charAt(0).toUpperCase() + role.slice(1)} (${posture})`
              });
            }
          } catch (e) {
            console.error('Error parsing SSE data:', e);
          }
        }
      }
    }

    return [{
      id: Date.now(),
      content: 'Streaming response completed',
      role: 'assistant',
      created_at: new Date().toISOString(),
      metadata: {
        assistant_name: `${role.charAt(0).toUpperCase() + role.slice(1)} (${posture})`,
        model: modelId
      }
    }];
  } else {
    // Use non-streaming endpoint for backward compatibility
    const response = await api.post(
      '/chat/completions',
      {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content }
        ],
        model: modelId,
        temperature: 0.7,
        max_tokens: 1000,
        stream: false
      }
    );

    if (!response.data || !response.data.choices || !response.data.choices[0]) {
      throw new Error('Invalid response format from LM Studio');
    }

    return [{
      id: Date.now(),
      content: response.data.choices[0].message.content,
      role: 'assistant',
      created_at: new Date().toISOString(),
      metadata: {
        assistant_name: `${role.charAt(0).toUpperCase() + role.slice(1)} (${posture})`,
        model: modelId
      }
    }];
  }
};

// Mock endpoints for conversation management
export const createConversation = async (title: string, isAutonomous: boolean) => {
  return {
    id: Date.now(),
    title,
    is_autonomous: isAutonomous
  };
};

export const addAssistant = async (
  conversationId: number,
  assistant: Assistant
) => {
  return {
    id: conversationId,
    ...assistant
  };
};

export const getConversationMessages = async () => [];
export const getConversationSummary = async () => ''; 