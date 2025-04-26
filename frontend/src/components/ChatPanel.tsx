import { useState, useEffect, useCallback, useRef } from 'react';
import { Paper, Title, Box, Stack, ScrollArea, Button, Text, Group, ActionIcon, Alert, Loader, Menu, Tooltip, Select, Badge } from '@mantine/core';
import { IconPlus, IconX, IconAlertCircle, IconBrain, IconBookmark, IconSearch, IconVolume, IconVolumeOff, IconTrash, IconPlayerPlay, IconPlayerPause, IconHeadphones, IconPlayerStop } from '@tabler/icons-react';
import Message from './Message';
import MessageInput from './MessageInput';
import ModelSelector from './ModelSelector';
import * as api from '../services/api';
import { getSystemPrompt } from '../config/assistantConfig';
import { audioManager, useAudioStore } from '../utils/audio';
import { notifications } from '@mantine/notifications';

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
  mode: 'individual' | 'sequential' | 'parallel' | 'cyclic';
  onRemove?: () => void;
  panelIndex?: number;
  totalPanels?: number;
  onSequentialMessage?: (message: string) => void;
  onParallelMessage?: (message: string) => void;
  currentCycle?: number;
  onRecordMessage?: (message: string, role: string, assistantName?: string) => void;
  recordSequentialConversation?: boolean;
  onModelResponse?: (isStarting: boolean) => void;
  onPanelComplete?: (panelIndex: number) => void;
  maxCycles?: number;
  initialModel?: {
    modelId: string;
    role: string;
    posture: string;
  } | null;
  onModelSelect?: (modelId: string, role: string, posture: string) => void;
}

interface Memory {
  id: string;
  content: string;
  metadata?: Record<string, any>;
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
  currentCycle = 0,
  onRecordMessage,
  recordSequentialConversation = false,
  onModelResponse,
  onPanelComplete,
  maxCycles = 3,
  initialModel,
  onModelSelect,
}: ChatPanelProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>(initialModel?.modelId || '');
  const [selectedRole, setSelectedRole] = useState<string>(initialModel?.role || 'researcher');
  const [selectedPosture, setSelectedPosture] = useState<string>(initialModel?.posture || 'professional');
  const [error, setError] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState<string>('Thinking...');
  const [loadingStartTime, setLoadingStartTime] = useState<number | null>(null);
  const [streamingContent, setStreamingContent] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isStopRequested, setIsStopRequested] = useState(false);
  const { isMuted, toggleMute, speak, stopSpeaking, autoReadEnabled, toggleAutoRead } = useAudioStore();
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [timerInterval, setTimerInterval] = useState<number | null>(null);
  const [selectedVoice, setSelectedVoice] = useState<string>('Microsoft Hazel Desktop');
  const [availableVoices, setAvailableVoices] = useState<Array<{value: string, label: string}>>([]);
  const [isReading, setIsReading] = useState(false);
  const [hasUnreadResponse, setHasUnreadResponse] = useState(false);
  const lastResponseRef = useRef<string>('');
  const [audioQueue, setAudioQueue] = useState<HTMLAudioElement[]>([]);
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);

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
            role: selectedRole,  // Use the current panel's role
            posture: selectedPosture,  // Use the current panel's posture
            system_prompt: getSystemPrompt(selectedRole, selectedPosture)
          });
        }
      } catch (error) {
        console.error('Error creating conversation:', error);
        setError('Failed to initialize conversation');
      }
    };

    initializeConversation();
  }, [title, isAutonomous, mode, selectedRole, selectedPosture]); // Add role and posture as dependencies

  // Separate useEffect for message handling
  useEffect(() => {
    const handleSequentialEvent = (event: CustomEvent) => {
      if (event.detail && event.detail.message && selectedModel) {
        // Update role and posture based on panel position in sequential mode
        if (mode === 'sequential' && event.detail.role && event.detail.posture) {
          setSelectedRole(event.detail.role);
          setSelectedPosture(event.detail.posture);
        }
        handleSendMessage(event.detail.message);
      }
    };

    const handleParallelEvent = (event: CustomEvent) => {
      if (event.detail && event.detail.message && selectedModel) {
        handleSendMessage(event.detail.message, true);
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
  }, [selectedModel, panelIndex, totalPanels, mode, selectedRole, selectedPosture]);

  // Update loading timer effect
  useEffect(() => {
    if (isLoading) {
      const startTime = Date.now();
      const interval = window.setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
      setTimerInterval(interval);
      setLoadingStartTime(startTime);
    } else {
      if (timerInterval) {
        window.clearInterval(timerInterval);
      }
      setElapsedTime(0);
      setTimerInterval(null);
      setLoadingStartTime(null);
    }

    return () => {
      if (timerInterval) {
        window.clearInterval(timerInterval);
      }
    };
  }, [isLoading]);

  // Handle sequential mode completion
  useEffect(() => {
    if (mode === 'sequential' && panelIndex === totalPanels - 1) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage && lastMessage.role === 'assistant') {
        // Record conversation if enabled
        if (recordSequentialConversation) {
          const conversation = messages.map(msg => ({
            role: msg.role,
            content: msg.content,
            assistantName: msg.assistantName,
            timestamp: new Date().toISOString()
          }));
          
          // Store in local storage or send to backend
          const conversations = JSON.parse(localStorage.getItem('sequential_conversations') || '[]');
          conversations.push({
            id: Date.now(),
            title: `Sequential Conversation ${conversations.length + 1}`,
            messages: conversation,
            date: new Date().toISOString()
          });
          localStorage.setItem('sequential_conversations', JSON.stringify(conversations));
        }
      }
    }
  }, [messages, mode, panelIndex, totalPanels, recordSequentialConversation]);

  // Update the text-to-speech effect
  useEffect(() => {
    return;
  }, [messages, mode, isLoading, isMuted, selectedModel]);

  // Keep panels interactive in sequential mode
  useEffect(() => {
    const panel = document.querySelector(`[data-panel-index="${panelIndex}"]`);
    if (panel) {
      panel.setAttribute('data-panel-state', isLoading ? 'loading' : 'ready');
    }
  }, [isLoading, panelIndex]);

  // Add useEffect to load voices
  useEffect(() => {
    const loadVoices = async () => {
      try {
        const response = await fetch('http://localhost:8000/api/v1/tts/voices');
        if (!response.ok) {
          throw new Error('Failed to fetch voices');
        }
        const voices = await response.json();
        setAvailableVoices(voices.map((voice: any) => ({
          value: voice.id,
          label: voice.name
        })));
        // Set default voice if none selected
        if (!selectedVoice && voices.length > 0) {
          setSelectedVoice(voices[0].id);
        }
      } catch (error) {
        console.error('Error loading voices:', error);
      }
    };
    loadVoices();
  }, []);

  // Update voice selection handler
  const handleVoiceChange = (value: string | null) => {
    if (value) {
      // Stop any current speech before changing voice
      audioManager.stopSpeaking();
      
      // Get current settings and update voice
      const currentSettings = useAudioStore.getState().getVoiceSettings(panelIndex.toString() || 'default');
      const updatedSettings = {
        ...currentSettings,
        voiceUri: value
      };
      
      // Save settings immediately
      useAudioStore.getState().updateVoiceSettings(panelIndex.toString() || 'default', updatedSettings);
      setSelectedVoice(value);
      audioManager.setVoice(value);
    }
  };

  // Update model selection handler
  const handleModelSelect = async (modelId: string, role: string, posture: string) => {
    try {
      setSelectedModel(modelId);
      setSelectedRole(role);
      setSelectedPosture(posture);
      setError(null);
      
      // Get voice settings for this panel
      const settings = useAudioStore.getState().getVoiceSettings(panelIndex.toString() || 'default');
      setSelectedVoice(settings.voiceUri);
      
      const conversation = await api.createConversation(title, isAutonomous);
      setConversationId(conversation.id);
      
      await api.addAssistant(conversation.id, {
        name: "Assistant",
        model: modelId,
        role: role,
        posture: posture,
        system_prompt: getSystemPrompt(role, posture)
      });

      // Notify parent about model selection
      onModelSelect?.(modelId, role, posture);
    } catch (error) {
      console.error('Error setting model:', error);
      setError(error instanceof Error ? error.message : 'Failed to set model');
      setSelectedModel('');
    }
  };

  // Add effect to initialize voice settings
  useEffect(() => {
    // Load saved voice settings for this panel's ID
    const settings = useAudioStore.getState().getVoiceSettings(panelIndex.toString() || 'default');
    setSelectedVoice(settings.voiceUri);
  }, [panelIndex]);

  // Add stop handler
  const handleStop = () => {
    setIsStopRequested(true);
    setIsLoading(false);
    setIsStreaming(false);
    setError(null);
  };

  // Add audio queue processor
  const processAudioQueue = async () => {
    if (!isProcessingAudio && audioQueue.length > 0) {
      setIsProcessingAudio(true);
      while (audioQueue.length > 0 && isReading) {
        const audio = audioQueue[0];
        try {
          await audio.play();
          await new Promise(resolve => {
            audio.onended = resolve;
          });
          setAudioQueue(prev => prev.slice(1));
        } catch (error) {
          console.error('Error playing audio:', error);
          break;
        }
      }
      setIsProcessingAudio(false);
    }
  };

  // Update the streaming content handling in handleSendMessage
  const handleSendMessage = async (content: string, isParallelResponse: boolean = false) => {
    if (!selectedModel || !selectedRole || !selectedPosture) {
      notifications.show({
        title: 'Error',
        message: 'Please select a model, role, and posture first',
        color: 'red'
      });
      return;
    }

    setIsLoading(true);
    setError(null);
    setStreamingContent('');
    let accumulatedResponse = '';

    try {
      const newMessage: ChatMessage = {
        id: Date.now(),
        content,
        role: 'user'
      };
      setMessages((prev: ChatMessage[]) => [...prev, newMessage]);

      // Record the message if needed
      if (onRecordMessage) {
        onRecordMessage(content, 'user');
      }

      // Notify that model is starting to respond
      onModelResponse?.(true);

      // Add thinking message
      const thinkingMessage: ChatMessage = {
        id: Date.now() + 1,
        content: '',
        role: 'assistant',
        assistantName: `${selectedRole} (${selectedPosture})`
      };
      setMessages((prev: ChatMessage[]) => [...prev, thinkingMessage]);

      const response = await fetch('http://192.168.50.89:1234/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: getSystemPrompt(selectedRole, selectedPosture) },
            { role: 'user', content }
          ],
          model: selectedModel,
          temperature: 0.7,
          max_tokens: 2000,
          stream: true
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response reader available');
      }

      let currentSentence = '';
      let readTimeout: any = null;

      const readSentence = (sentence: string) => {
        if (autoReadEnabled && !isMuted && sentence.trim()) {
          try {
            fetch('http://localhost:8000/api/v1/tts/speak', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                text: sentence.trim(),
                voice: selectedVoice,
                service: 'windows'
              })
            })
            .then(response => response.blob())
            .then(audioBlob => {
              const audioUrl = URL.createObjectURL(audioBlob);
              const audio = new Audio(audioUrl);
              audio.onended = () => {
                URL.revokeObjectURL(audioUrl);
              };
              setAudioQueue(prev => [...prev, audio]);
              if (!isProcessingAudio) {
                void processAudioQueue();
              }
            })
            .catch(error => {
              console.error('Error in TTS:', error);
            });
          } catch (error) {
            console.error('Error in TTS:', error);
          }
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = new TextDecoder().decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(5);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              if (parsed.choices?.[0]?.delta?.content) {
                const content = parsed.choices[0].delta.content;
                accumulatedResponse += content;
                setStreamingContent(accumulatedResponse);
                
                // Update the last message with the accumulated response
                setMessages((prev: ChatMessage[]) => {
                  const newMessages = [...prev];
                  const lastMessage = newMessages[newMessages.length - 1];
                  if (lastMessage && lastMessage.role === 'assistant') {
                    lastMessage.content = accumulatedResponse;
                  }
                  return newMessages;
                });

                // Accumulate content into current sentence
                currentSentence += content;

                // Clear any existing timeout
                if (readTimeout) {
                  clearTimeout(readTimeout);
                }

                // Set new timeout to read the sentence
                readTimeout = setTimeout(() => {
                  if (currentSentence.trim()) {
                    readSentence(currentSentence);
                    currentSentence = '';
                  }
                }, 500); // Wait for 500ms of no new content before reading

                // Also check for sentence endings
                if (/[.!?]\s*$/.test(currentSentence)) {
                  if (readTimeout) {
                    clearTimeout(readTimeout);
                  }
                  readSentence(currentSentence);
                  currentSentence = '';
                }
              }
            } catch (e) {
              console.error('Error parsing SSE data:', e);
            }
          }
        }
      }

      // Read any remaining content
      if (currentSentence.trim()) {
        readSentence(currentSentence);
      }

      // Record the assistant's message if needed
      if (onRecordMessage) {
        onRecordMessage(
          accumulatedResponse,
          'assistant',
          `${selectedRole} (${selectedPosture})`
        );
      }

      // Handle sequential/parallel mode logic
      if (mode === 'sequential' && onSequentialMessage && !isParallelResponse) {
        onSequentialMessage(accumulatedResponse);
      } else if (mode === 'parallel' && onParallelMessage) {
        onParallelMessage(accumulatedResponse);
      }

      // Notify that model has finished responding
      onModelResponse?.(false);
      onPanelComplete?.(panelIndex);

    } catch (error) {
      console.error('Error in chat:', error);
      setError(error instanceof Error ? error.message : 'An error occurred during the chat');
      // Remove the thinking message on error
      setMessages((prev: ChatMessage[]) => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSpeechInput = (text: string) => {
    if (selectedModel) {
      handleSendMessage(text);
    }
  };

  const handleDeleteMessage = (messageId: number) => {
    setMessages((prev: ChatMessage[]) => prev.filter((msg: ChatMessage) => msg.id !== messageId));
  };

  const handleClearChat = () => {
    setMessages([]);
  };

  // Clean up TTS when component unmounts
  useEffect(() => {
    return () => {
      if (isReading) {
        audioManager.stopSpeaking();
        setIsReading(false);
      }
    };
  }, [isReading]);

  // Update the read toggle handler
  const handleReadToggle = () => {
    if (isReading) {
      setIsReading(false);
      // Stop all audio and clear the queue
      audioManager.stopSpeaking();
      setAudioQueue([]);
      setIsProcessingAudio(false);
    } else {
      setIsReading(true);
      // Start reading from the current streaming content
      if (streamingContent) {
        // Stop any existing speech first
        audioManager.stopSpeaking();
        
        fetch('http://localhost:8000/api/v1/tts/speak', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            text: streamingContent,
            voice: selectedVoice,
            service: 'windows'
          })
        })
        .then(response => response.blob())
        .then(audioBlob => {
          const audioUrl = URL.createObjectURL(audioBlob);
          const audio = new Audio(audioUrl);
          audio.onended = () => {
            URL.revokeObjectURL(audioUrl);
            setIsReading(false);
          };
          setAudioQueue([audio]);
          processAudioQueue();
        })
        .catch(error => {
          console.error('Error in TTS:', error);
          setIsReading(false);
        });
      }
    }
  };

  // Clean up audio resources when component unmounts or reading stops
  useEffect(() => {
    if (!isReading) {
      audioManager.stopSpeaking();
      setAudioQueue([]);
      setIsProcessingAudio(false);
    }
    return () => {
      audioManager.stopSpeaking();
      setAudioQueue([]);
      setIsProcessingAudio(false);
    };
  }, [isReading]);

  const handleFileUpload = (file: File) => {
    // File has already been read and added to the message input
    // You can add additional handling here if needed, such as:
    // - Storing the file metadata
    // - Processing the file in a different way
    // - Sending the file to a server
    console.log('File uploaded:', file.name);
  };

  // Function to handle reading the response
  const readResponse = useCallback((response: string) => {
    if (!response) return;
    setIsReading(true);
    speak(response, {
      onEnd: () => {
        setIsReading(false);
        setHasUnreadResponse(false);
        onPanelComplete?.(panelIndex);
      },
      onError: () => {
        setIsReading(false);
        setHasUnreadResponse(false);
      }
    });
  }, [speak, onPanelComplete, panelIndex]);

  // Handle auto-reading when new responses arrive
  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === 'assistant' && lastMessage.content !== lastResponseRef.current) {
        lastResponseRef.current = lastMessage.content;
        setHasUnreadResponse(true);
        
        if (autoReadEnabled) {
          readResponse(lastMessage.content);
        }
      }
    }
  }, [messages, autoReadEnabled, readResponse]);

  // Stop reading when auto-read is disabled
  useEffect(() => {
    if (!autoReadEnabled && isReading) {
      stopSpeaking();
      setIsReading(false);
    }
  }, [autoReadEnabled, isReading, stopSpeaking]);

  const handleAssistantResponse = useCallback(async (response: string) => {
    // Mark panel as used in sequential mode
    if (mode === 'sequential') {
      const panel = document.querySelector(`[data-panel-index="${panelIndex}"]`);
      if (panel) {
        panel.setAttribute('data-sequential-used', 'true');
      }
    }

    // Handle TTS based on mode
    if (autoReadEnabled) {
      // In parallel mode, only one voice can speak at a time
      if (mode === 'parallel') {
        // Wait for any existing speech to finish
        if (window.speechSynthesis.speaking) {
          window.speechSynthesis.cancel();
        }
      }

      // Don't read if this panel was already used in sequential mode
      if (mode === 'sequential') {
        const panel = document.querySelector(`[data-panel-index="${panelIndex}"]`);
        if (panel?.hasAttribute('data-sequential-used')) {
          return;
        }
      }

      // Read the response
      const sentences = response.match(/[^.!?]+[.!?]+/g) || [response];
      for (const sentence of sentences) {
        await new Promise<void>((resolve) => {
          const utterance = new SpeechSynthesisUtterance(sentence.trim());
          utterance.onend = () => resolve();
          utterance.onerror = () => {
            console.error('TTS error occurred');
            resolve();
          };
          window.speechSynthesis.speak(utterance);
        });
      }
    }
  }, [panelIndex, mode, autoReadEnabled]);

  // Update mode badge
  const getModeBadge = () => {
    switch (mode) {
      case 'individual':
        return null;
      case 'sequential':
        return (
          <Badge color="blue" variant="light">
            Sequential
          </Badge>
        );
      case 'parallel':
        return (
          <Badge color="green" variant="light">
            Parallel
          </Badge>
        );
      case 'cyclic':
        return (
          <Badge color="purple" variant="light">
            Cyclic
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <Paper 
      shadow="sm" 
      p="xs"
      className="chat-panel"
      data-panel-index={panelIndex}
      style={{ 
        height: '100%', 
        background: 'var(--surface-color)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        minHeight: 0,
        marginBottom: 0
      }}
      onDragOver={(e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.currentTarget.style.boxShadow = '0 0 10px #39ff14';
        e.dataTransfer.dropEffect = 'copy';
      }}
      onDragLeave={(e: React.DragEvent<HTMLDivElement>) => {
        e.currentTarget.style.boxShadow = '';
      }}
      onDrop={async (e: React.DragEvent<HTMLDivElement>) => {
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
      <Stack h="100%" gap="xs" style={{ flex: 1, minHeight: 0 }}>
        <Box className="panel-header" style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          flexShrink: 0
        }}>
          <Group justify="space-between" w="100%" align="center">
            <Title order={3}>
              {selectedRole && selectedPosture ? `${selectedPosture} ${selectedRole}` : title}
              <Text size="xs" c="dimmed" style={{ marginLeft: '0.5rem' }}>
                ({mode} mode)
              </Text>
            </Title>
            <Group gap="xs">
              <Select
                placeholder="Select voice"
                data={availableVoices}
                value={selectedVoice}
                onChange={handleVoiceChange}
                style={{ width: '200px' }}
                size="sm"
              />
              <Tooltip label={autoReadEnabled ? "Stop Auto-Reading" : "Start Auto-Reading"}>
                <ActionIcon
                  variant={autoReadEnabled ? "filled" : "light"}
                  color={autoReadEnabled ? "teal" : "gray"}
                  onClick={toggleAutoRead}
                  loading={isReading}
                >
                  <IconVolume size={20} />
                </ActionIcon>
              </Tooltip>
              {(isLoading || isStreaming) && (
                <Button 
                  variant="light"
                  color="red"
                  size="sm"
                  onClick={handleStop}
                >
                  Stop
                </Button>
              )}
              <Tooltip label="Clear Chat">
                <ActionIcon
                  variant="light"
                  color="red"
                  size="lg"
                  onClick={handleClearChat}
                  disabled={messages.length === 0}
                >
                  <IconTrash size={18} />
                </ActionIcon>
              </Tooltip>
              {onRemove && (
                <ActionIcon
                  variant="light"
                  color="red"
                  onClick={onRemove}
                >
                  <IconX size={16} />
                </ActionIcon>
              )}
            </Group>
          </Group>
        </Box>

        <ModelSelector
          onModelSelect={handleModelSelect}
          selectedModel={selectedModel}
          disabled={isLoading}
          style={{ flexShrink: 0 }}
        />
        
        <Box style={{ 
          display: 'flex', 
          gap: '1rem', 
          flex: 1,
          minHeight: 0,
          overflow: 'hidden'
        }}>
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
              {messages.map((message, index) => {
                // Determine if this is the last assistant message and streaming is active
                const isLastAssistant =
                  message.role === 'assistant' &&
                  index === messages.length - 1 &&
                  isLoading && streamingContent !== '';
                return (
                  <Box key={`${message.id}-${index}`}>
                    <Message
                      content={message.content}
                      role={message.role}
                      assistantName={message.assistantName}
                      onSpeechInput={handleSpeechInput}
                      onDelete={() => handleDeleteMessage(message.id)}
                      isThinking={isLastAssistant}
                    />
                  </Box>
                );
              })}
              {isLoading && (
                <Paper p="md" style={{ 
                  backgroundColor: 'var(--mantine-color-dark-6)',
                  border: '1px solid var(--mantine-color-dark-5)',
                  borderRadius: '8px'
                }}>
                  <Group gap="sm" align="center">
                    <Loader size="sm" color="#39ff14" />
                    <Box>
                      <Text size="sm" c="#39ff14">{loadingMessage}</Text>
                      {loadingStartTime && (
                        <Text size="xs" c="dimmed" mt={4}>
                          Time elapsed: {elapsedTime}s
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
        </Box>

        <MessageInput
          onSend={handleSendMessage}
          onFileUpload={handleFileUpload}
          disabled={isLoading || !conversationId || !selectedModel}
          style={{ flexShrink: 0 }}
        />
      </Stack>
    </Paper>
  );
};

export default ChatPanel; 