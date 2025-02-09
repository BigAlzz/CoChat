import { useState, useEffect } from 'react';
import { Paper, Title, Box, Stack, ScrollArea, Button, Text, Group, ActionIcon, Alert } from '@mantine/core';
import { IconPlus, IconX, IconAlertCircle } from '@tabler/icons-react';
import Message from './Message';
import MessageInput from './MessageInput';
import ModelSelector from './ModelSelector';
import * as api from '../services/api';

interface ChatMessage {
  id: number;
  content: string;
  role: 'user' | 'assistant';
  assistantName?: string;
}

interface LMStudioMessage {
  id: number;
  content: string | null;
  role: string;
  created_at: string;
  metadata: {
    assistant_name: string;
    model: string;
  };
}

interface ChatPanelProps {
  title: string;
  isAutonomous: boolean;
  onRemove?: () => void;
}

const ChatPanel = ({ title, isAutonomous, onRemove }: ChatPanelProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initializeConversation = async () => {
      try {
        const conversation = await api.createConversation(title, isAutonomous);
        setConversationId(conversation.id);
      } catch (error) {
        console.error('Error creating conversation:', error);
      }
    };

    initializeConversation();
  }, [title, isAutonomous]);

  const handleModelSelect = async (modelId: string) => {
    setSelectedModel(modelId);
    
    try {
      // Create a conversation and add the assistant in one step
      const conversation = await api.createConversation(title, isAutonomous);
      setConversationId(conversation.id);
      
      await api.addAssistant(conversation.id, {
        name: "Assistant",
        model: modelId,
        role: "assistant",
        posture: "helpful",
        system_prompt: "You are a helpful AI assistant."
      });
    } catch (error) {
      console.error('Error setting model:', error);
      setError(error instanceof Error ? error.message : 'Failed to set model');
      setSelectedModel(undefined);
    }
  };

  const handleSendMessage = async (content: string) => {
    if (!selectedModel) return;

    const userMessage: ChatMessage = {
      id: Date.now(),
      content,
      role: 'user'
    };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);

    try {
      const responses = await api.sendMessage(selectedModel, content);
      
      if (!responses || !Array.isArray(responses)) {
        console.error('Invalid response format:', responses);
        setError('Failed to get response from the model. Please try again.');
        return;
      }
      
      const newMessages = responses
        .filter((msg: LMStudioMessage) => msg.role === 'assistant')
        .map((msg: LMStudioMessage) => ({
          id: msg.id,
          content: msg.content || 'No response from model',
          role: 'assistant' as const,
          assistantName: msg.metadata?.assistant_name
        }));

      if (newMessages.length === 0) {
        console.error('No assistant messages in response:', responses);
        setError('No response received from the model. Please try again.');
        return;
      }

      setMessages(prev => [...prev, ...newMessages]);
    } catch (error) {
      console.error('Error sending message:', error);
      setError(error instanceof Error ? error.message : 'Failed to send message. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Paper 
      shadow="sm" 
      p="md" 
      className="chat-panel"
      style={{ 
        height: '100%', 
        background: 'var(--surface-color)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
    >
      <Stack h="100%" gap="xs" style={{ flex: 1 }}>
        <Box className="panel-header" style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          flexShrink: 0
        }}>
          <Title order={3}>{title}</Title>
          <Group gap="xs">
            <Button 
              variant="light"
              size="sm"
              className="new-chat-button"
              leftSection={<IconPlus size={16} />}
              onClick={() => {
                setMessages([]);
                setSelectedModel(undefined);
                setError(null);
                const initializeConversation = async () => {
                  try {
                    const conversation = await api.createConversation(title, isAutonomous);
                    setConversationId(conversation.id);
                  } catch (error) {
                    console.error('Error creating conversation:', error);
                    setError('Failed to create new conversation');
                  }
                };
                initializeConversation();
              }}
            >
              New Chat
            </Button>
            {onRemove && (
              <ActionIcon
                variant="light"
                color="red"
                onClick={onRemove}
                title="Remove panel"
              >
                <IconX size={16} />
              </ActionIcon>
            )}
          </Group>
        </Box>

        <ModelSelector
          onModelSelect={handleModelSelect}
          selectedModel={selectedModel}
          disabled={isLoading}
          style={{ flexShrink: 0 }}
        />
        
        <ScrollArea 
          style={{ 
            flex: 1,
            minHeight: 0,
            border: '1px solid var(--border-color)',
            borderRadius: '4px',
            backgroundColor: 'var(--background-color)',
            display: 'flex',
            flexDirection: 'column'
          }} 
          offsetScrollbars
          scrollbarSize={8}
          type="hover"
          viewportRef={(viewport) => {
            if (viewport) {
              viewport.scrollTop = viewport.scrollHeight;
            }
          }}
        >
          <Stack gap="xs" p="md" style={{ flex: 1 }}>
            {messages.map(message => (
              <Message
                key={message.id}
                content={message.content}
                role={message.role}
                assistantName={message.assistantName}
              />
            ))}
            {isLoading && (
              <Paper p="md" style={{ backgroundColor: 'var(--surface-color)' }}>
                <Text size="sm" c="dimmed">Thinking...</Text>
              </Paper>
            )}
            {error && (
              <Alert 
                icon={<IconAlertCircle size={16} />} 
                color="red" 
                title="Error" 
                variant="light"
              >
                {error}
              </Alert>
            )}
          </Stack>
        </ScrollArea>

        <MessageInput
          onSend={handleSendMessage}
          disabled={isLoading || !conversationId || !selectedModel}
          style={{ flexShrink: 0 }}
        />
      </Stack>
    </Paper>
  );
};

export default ChatPanel; 