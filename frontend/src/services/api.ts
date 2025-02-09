import axios from 'axios';

const API_BASE_URL = 'http://192.168.50.89:1234/v1';

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
  metadata?: Record<string, any>;
}

export interface LMStudioResponse {
  data: Array<{
    id: string;
    object: string;
    owned_by: string;
  }>;
  object: string;
}

export interface Model {
  id: string;
  name: string;
  object?: string;
  owned_by?: string;
}

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 second timeout
  withCredentials: false // Disable credentials for CORS
});

// Add response interceptor for better error handling
api.interceptors.response.use(
  response => response,
  error => {
    console.error('API Error:', error);
    if (error.code === 'ECONNABORTED') {
      throw new Error('Connection timeout. Please check if LM Studio is running and accessible at http://192.168.50.89:1234');
    }
    if (!error.response) {
      throw new Error('Network error. Please ensure LM Studio is running and accessible at http://192.168.50.89:1234');
    }
    if (error.response.status === 404) {
      throw new Error('API endpoint not found. Please check if LM Studio is running correctly.');
    }
    throw error;
  }
);

export const getAvailableModels = async (): Promise<LMStudioResponse['data']> => {
  try {
    const response = await api.get<LMStudioResponse>('/models');
    console.log('Models response:', response.data);
    
    if (response.data) {
      if (Array.isArray(response.data)) {
        return response.data;
      } else if (response.data.data && Array.isArray(response.data.data)) {
        return response.data.data;
      }
    }
    throw new Error('Invalid response format from LM Studio. Please ensure the server is running correctly.');
  } catch (error) {
    console.error('Error fetching models:', error);
    if (error instanceof Error) {
      throw new Error(`Failed to fetch models: ${error.message}`);
    }
    throw error;
  }
};

export const createConversation = async (title: string, isAutonomous: boolean) => {
  // For LM Studio, we'll just return a mock conversation object
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
  // Store the selected model ID
  return {
    id: conversationId,
    ...assistant
  };
};

export const sendMessage = async (
  modelId: string, // Changed from conversationId to modelId
  content: string
) => {
  const response = await api.post(
    '/chat/completions',
    { 
      messages: [{ role: 'user', content }],
      model: modelId, // Use the actual model ID here
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
      assistant_name: 'LM Studio Assistant',
      model: modelId
    }
  }];
};

// Remove unused endpoints since we're communicating directly with LM Studio
export const getConversationMessages = async () => [];
export const getConversationSummary = async () => '';

// Update model management to use LM Studio endpoints
export const addModel = async (model: Model) => {
  const response = await api.post('/models', model);
  return response.data;
};

export const removeModel = async (modelId: string) => {
  const response = await api.delete(`/models/${modelId}`);
  return response.data;
}; 