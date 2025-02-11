import { useState, useEffect } from 'react';
import { Paper, Title, Box, Stack, ScrollArea, Button, Text, Group, ActionIcon, Alert, Loader } from '@mantine/core';
import { IconPlus, IconX, IconAlertCircle } from '@tabler/icons-react';
import Message from './Message';
import MessageInput from './MessageInput';
import ModelSelector from './ModelSelector';
import * as api from '../services/api';
import { getSystemPrompt } from '../config/assistantConfig';

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
  mode: 'individual' | 'sequential' | 'parallel' | 'iteration';
  onRemove?: () => void;
  panelIndex?: number;
  totalPanels?: number;
  onSequentialMessage?: (message: string) => void;
  onParallelMessage?: (message: string) => void;
  currentCycle?: number;
}

const ChatPanel = ({ 
  title, 
  isAutonomous, 
  mode, 
  onRemove,
  panelIndex = 0,
  totalPanels = 1,
  onSequentialMessage,
  onParallelMessage,
  currentCycle = 0
}: ChatPanelProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>();
  const [selectedRole, setSelectedRole] = useState<string>('analyst');
  const [selectedPosture, setSelectedPosture] = useState<string>('professional');
  const [error, setError] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState<string>('Thinking...');
  const [loadingStartTime, setLoadingStartTime] = useState<number | null>(null);
  const [streamingContent, setStreamingContent] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState(false);

  // Reset conversation when mode changes
  useEffect(() => {
    const initializeConversation = async () => {
      try {
        const conversation = await api.createConversation(title, isAutonomous);
        setConversationId(conversation.id);
        
        // If we have a selected model, re-add the assistant with new mode settings
        if (selectedModel) {
          await api.addAssistant(conversation.id, {
            name: "Assistant",
            model: selectedModel,
            role: "assistant",
            posture: mode === 'individual' ? "helpful" : mode === 'sequential' ? "sequential" : "parallel",
            system_prompt: `You are a helpful AI assistant operating in ${mode} mode.`
          });
        }
      } catch (error) {
        console.error('Error creating conversation:', error);
        setError('Failed to initialize conversation');
      }
    };

    initializeConversation();
  }, [title, isAutonomous, mode]); // Add mode as a dependency

  // Separate useEffect for message handling
  useEffect(() => {
    const handleSequentialEvent = (event: CustomEvent) => {
      if (event.detail && event.detail.message && selectedModel) {
        handleSendMessage(event.detail.message);
      }
    };

    const handleParallelEvent = (event: CustomEvent) => {
      if (event.detail && event.detail.message && selectedModel) {
        handleSendMessage(event.detail.message, true);  // true indicates it's a parallel message
      }
    };

    const panel = document.querySelector(`[data-panel-index="${panelIndex}"]`);
    if (panel) {
      panel.addEventListener('sequential-message', handleSequentialEvent as EventListener);
      panel.addEventListener('parallel-message', handleParallelEvent as EventListener);
    }

    return () => {
      if (panel) {
        panel.removeEventListener('sequential-message', handleSequentialEvent as EventListener);
        panel.removeEventListener('parallel-message', handleParallelEvent as EventListener);
      }
    };
  }, [selectedModel, panelIndex, totalPanels, mode]); // Add mode as a dependency

  // Add a useEffect to update the loading message based on time elapsed
  useEffect(() => {
    if (!isLoading) {
      setLoadingMessage('Thinking...');
      setLoadingStartTime(null);
      return;
    }

    setLoadingStartTime(Date.now());
    const interval = setInterval(() => {
      if (loadingStartTime) {
        const elapsedSeconds = Math.floor((Date.now() - loadingStartTime) / 1000);
        if (elapsedSeconds > 30) {
          setLoadingMessage('Still processing... This model might take a few minutes to respond.');
        } else if (elapsedSeconds > 10) {
          setLoadingMessage('Processing your request... This might take a moment.');
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isLoading, loadingStartTime]);

  const handleModelSelect = async (modelId: string, role: string, posture: string) => {
    setSelectedModel(modelId);
    setSelectedRole(role);
    setSelectedPosture(posture);
    setError(null);
    
    try {
      const conversation = await api.createConversation(title, isAutonomous);
      setConversationId(conversation.id);
      
      await api.addAssistant(conversation.id, {
        name: "Assistant",
        model: modelId,
        role: role,
        posture: posture,
        system_prompt: getSystemPrompt(role, posture),
      });
    } catch (error) {
      console.error('Error setting model:', error);
      setError(error instanceof Error ? error.message : 'Failed to set model');
      setSelectedModel(undefined);
    }
  };

  const handleSendMessage = async (content: string, isParallelResponse: boolean = false) => {
    if (!selectedModel) {
      setError('Please select a model first');
      return;
    }

    // Only add user message for the originating panel in parallel mode
    if (!isParallelResponse) {
      const userMessage: ChatMessage = {
        id: Date.now(),
        content,
        role: 'user'
      };
      setMessages(prev => [...prev, userMessage]);
    }
    
    setIsLoading(true);
    setError(null);
    setStreamingContent('');
    setIsStreaming(true);

    try {
      const streamingMessage: ChatMessage = {
        id: Date.now(),
        content: '',
        role: 'assistant'
      };

      setMessages(prev => [...prev, streamingMessage]);

      await api.sendMessage(
        selectedModel,
        content,
        selectedRole,
        selectedPosture,
        (chunk) => {
          setStreamingContent(prev => {
            const newContent = prev + chunk.content;
            // Update the streaming message in the messages array
            setMessages(messages => 
              messages.map(msg => 
                msg.id === streamingMessage.id 
                  ? { ...msg, content: newContent, assistantName: chunk.assistant_name }
                  : msg
              )
            );
            return newContent;
          });
        }
      );
      
      setIsStreaming(false);

      // Handle sequential and iteration modes
      if ((mode === 'sequential' || mode === 'iteration') && onSequentialMessage) {
        setTimeout(() => {
          onSequentialMessage(streamingContent);
        }, 100);
      }
      
      // Handle parallel mode - only for the originating message
      if (mode === 'parallel' && !isParallelResponse && onParallelMessage) {
        onParallelMessage(content);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setError(error instanceof Error ? error.message : 'Failed to send message. Please try again.');
      // Remove the streaming message if there was an error
      setMessages(prev => prev.filter(msg => msg.content !== ''));
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
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
      onDragOver={(e) => {
        e.preventDefault();
        e.currentTarget.style.boxShadow = '0 0 10px #39ff14';
        e.dataTransfer.dropEffect = 'copy';
      }}
      onDragLeave={(e) => {
        e.currentTarget.style.boxShadow = '';
      }}
      onDrop={async (e) => {
        e.preventDefault();
        e.currentTarget.style.boxShadow = '';
        const content = e.dataTransfer.getData('text/plain');
        if (content && selectedModel) {
          handleSendMessage(content);
        } else if (!selectedModel) {
          setError('Please select a model before dropping a message');
        }
      }}
    >
      <Stack h="100%" gap="xs" style={{ flex: 1 }}>
        <Box className="panel-header" style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          flexShrink: 0
        }}>
          <Title order={3}>
            {title}
            <Text size="xs" c="dimmed" style={{ marginLeft: '0.5rem' }}>
              ({mode} mode{mode === 'iteration' && panelIndex === 0 ? ` - Cycle ${currentCycle + 1}` : ''})
            </Text>
          </Title>
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
              <Paper p="md" style={{ 
                backgroundColor: 'var(--mantine-color-dark-6)',
                border: '1px solid var(--mantine-color-dark-5)',
                borderRadius: '8px'
              }}>
                <Group gap="sm" align="center">
                  <Loader size="sm" color="green" />
                  <Box>
                    <Text size="sm" c="dimmed">{loadingMessage}</Text>
                    {loadingStartTime && (
                      <Text size="xs" c="dimmed" mt={4}>
                        Time elapsed: {Math.floor((Date.now() - loadingStartTime) / 1000)}s
                      </Text>
                    )}
                  </Box>
                </Group>
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
                {error.includes('taking longer') && (
                  <Text size="sm" mt="xs" c="dimmed">
                    The model is still processing. Please wait...
                  </Text>
                )}
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