import { Modal, Button, Group, Text, Select, Stack, Paper, CopyButton, Tooltip, Loader, Alert, ScrollArea } from '@mantine/core';
import { IconCopy, IconDownload, IconCheck, IconAlertCircle, IconBrandWhatsapp, IconListNumbers, IconFileText, IconPlayerPause, IconPlayerStop, IconPlayerPlay, IconHeadphones, IconBrandTelegram, IconPdf } from '@tabler/icons-react';
import { useState, useEffect } from 'react';
import * as api from '../services/api';
import AudioManager from '../services/AudioManager';

interface SummaryModalProps {
  opened: boolean;
  onClose: () => void;
  conversations: Array<{
    role: string;
    content: string;
    assistantName?: string;
    timestamp?: string;
    panelIndex?: number;
  }>;
  onExport: (format: string, content: string) => void;
}

interface SelectItem {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

interface Model {
  id: string;
  name: string;
}

export default function SummaryModal({ opened, onClose, conversations, onExport }: SummaryModalProps) {
  const [summaryType, setSummaryType] = useState<string>('concise');
  const [summaryContent, setSummaryContent] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [models, setModels] = useState<Model[]>([]);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentReadingIndex, setCurrentReadingIndex] = useState<number>(-1);
  const [isReadingSummary, setIsReadingSummary] = useState(false);
  const [isSummaryPaused, setIsSummaryPaused] = useState(false);
  const [showWhatsAppPreview, setShowWhatsAppPreview] = useState(false);
  const [whatsAppContent, setWhatsAppContent] = useState('');

  useEffect(() => {
    const loadModels = async () => {
      setIsLoadingModels(true);
      setError(null);
      try {
        const availableModels = await api.getAvailableModels();
        if (availableModels && availableModels.length > 0) {
          setModels(availableModels.map(model => ({
            id: model.id,
            name: model.name || model.id
          })));
          // Set the first model as default if none selected
          if (!selectedModel) {
            setSelectedModel(availableModels[0].id);
          }
        } else {
          throw new Error('No models available. Please ensure LM Studio is running and has models loaded.');
        }
      } catch (error) {
        console.error('Error loading models:', error);
        setError(error instanceof Error ? error.message : 'Failed to load models. Please check if LM Studio is running.');
      } finally {
        setIsLoadingModels(false);
      }
    };

    if (opened) {
      loadModels();
    }
  }, [opened, selectedModel]);

  useEffect(() => {
    if (!opened) {
      setIsReading(false);
      setIsPaused(false);
      setCurrentReadingIndex(-1);
      AudioManager.getInstance().stopSpeaking();
    }
  }, [opened]);

  const generateSummary = async () => {
    if (!selectedModel) {
      setError('Please select a model first');
      return;
    }

    if (conversations.length === 0) {
      setError('No conversation to summarize');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setSummaryContent('');
    
    try {
      // Format conversations for the summary
      const formattedConversations = conversations.map(conv => ({
        panelIndex: conv.panelIndex || 0,
        messages: [{
          role: conv.role,
          content: conv.content,
          assistant: conv.assistantName,
          timestamp: conv.timestamp
        }]
      }));

      // Create system prompt based on summary type
      let systemPrompt;
      switch (summaryType) {
        case 'whatsapp':
          systemPrompt = `Create a WhatsApp-style summary of the conversation using emojis and brief points. Format should be:

📱 *Main Topic*
➡️ Key Point 1
➡️ Key Point 2
💡 Insights
✅ Conclusions

Keep it concise and engaging, using appropriate emojis for different types of information.`;
          break;
        case 'detailed':
          systemPrompt = `Create a detailed report of the multi-panel conversation. Include:

1. Executive Summary
2. Question/Initial Prompt
3. Panel-by-Panel Analysis
4. Key Discussion Points
5. Cross-Panel Insights
6. Conclusions
7. Recommendations

For each panel, clearly indicate the role of the AI assistant and their specific contributions.`;
          break;
        default: // concise
          systemPrompt = `Create a concise summary of the multi-panel conversation. Include:

1. Initial Question/Prompt
2. Key Points from Each Panel
3. Overall Conclusions

Format the output in a clear, readable structure with panel numbers and assistant roles.`;
      }

      // Send to API for summarization
      const response = await fetch(`http://192.168.50.89:1234/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Please analyze and summarize the following conversation:\n\n${conversations.map(conv => 
              `${conv.role === 'assistant' ? (conv.assistantName || 'Assistant') : 'User'}: ${conv.content}`
            ).join('\n\n')}` }
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

      // Handle streaming response
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Failed to get response reader');
      }

      let currentSummary = '';
      let processingMessage = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Convert the chunk to text
        const chunk = new TextDecoder().decode(value);
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
          try {
            if (line.startsWith('data: ')) {
              const data = line.slice(5);
              if (data === '[DONE]') continue;
              
              const parsed = JSON.parse(data);
              if (parsed.choices?.[0]?.delta?.content) {
                currentSummary += parsed.choices[0].delta.content;
                setSummaryContent(currentSummary);
              }
            }
          } catch (e) {
            console.error('Error parsing chunk:', e);
            continue;
          }
        }
      }
    } catch (error) {
      console.error('Error generating summary:', error);
      setError(error instanceof Error ? error.message : 'Failed to generate summary');
    } finally {
      setIsGenerating(false);
    }
  };

  const readPanelMessages = async () => {
    if (!conversations.length) {
      setError('No conversation to read');
      return;
    }

    setIsReading(true);
    setIsPaused(false);
    setError(null);

    try {
      // Group conversations by panel
      const conversationsByPanel = conversations.reduce((acc, conv) => {
        const panelIndex = conv.panelIndex || 0;
        if (!acc[panelIndex]) {
          acc[panelIndex] = [];
        }
        acc[panelIndex].push(conv);
        return acc;
      }, {} as Record<number, typeof conversations>);

      // Sort panels by index
      const sortedPanels = Object.entries(conversationsByPanel)
        .sort(([a], [b]) => Number(a) - Number(b));

      for (let i = 0; i < sortedPanels.length; i++) {
        if (!isReading) break; // Stop if reading was cancelled
        
        const [panelIndex, messages] = sortedPanels[i];
        setCurrentReadingIndex(Number(panelIndex));

        // Find the assistant's role for this panel
        const assistantMessage = messages.find(msg => msg.role === 'assistant');
        const roleAnnouncement = assistantMessage?.assistantName || 'Assistant';

        // Announce role instead of panel number
        await AudioManager.getInstance().speak(`${roleAnnouncement}'s conversation`);

        // Read each message in the panel
        for (const message of messages) {
          if (!isReading) break; // Stop if reading was cancelled
          
          const speaker = message.role === 'assistant' 
            ? message.assistantName || 'Assistant'
            : 'User';
            
          await AudioManager.getInstance().speak(`${speaker} says: ${message.content}`);
        }
      }
    } catch (error) {
      console.error('Error reading messages:', error);
      setError(error instanceof Error ? error.message : 'Failed to read messages');
      return;
    }

    // After reading all messages, generate summary
    if (isReading) {
      try {
        await generateSummary();
      } catch (error) {
        console.error('Error generating summary:', error);
        setError(error instanceof Error ? error.message : 'Failed to generate summary');
      }
    }

    setIsReading(false);
    setIsPaused(false);
    setCurrentReadingIndex(-1);
  };

  const handleReadToggle = async () => {
    if (isReading) {
      if (isPaused) {
        setIsPaused(false);
        try {
          await AudioManager.getInstance().resumeSpeaking();
        } catch (error) {
          console.error('Error resuming speech:', error);
          setError(error instanceof Error ? error.message : 'Failed to resume reading');
        }
      } else {
        setIsPaused(true);
        AudioManager.getInstance().pauseSpeaking();
      }
    } else {
      readPanelMessages();
    }
  };

  const handleReadSummary = async () => {
    if (isReadingSummary) {
      if (isSummaryPaused) {
        setIsSummaryPaused(false);
        try {
          await AudioManager.getInstance().resumeSpeaking();
        } catch (error) {
          console.error('Error resuming speech:', error);
          setError(error instanceof Error ? error.message : 'Failed to resume reading');
        }
      } else {
        setIsSummaryPaused(true);
        AudioManager.getInstance().pauseSpeaking();
      }
    } else {
      setIsReadingSummary(true);
      setIsSummaryPaused(false);
      try {
        await AudioManager.getInstance().speak(summaryContent);
      } catch (error) {
        console.error('Error reading summary:', error);
        setError(error instanceof Error ? error.message : 'Failed to read summary');
      } finally {
        setIsReadingSummary(false);
        setIsSummaryPaused(false);
      }
    }
  };

  // Add cleanup for summary reading
  useEffect(() => {
    if (!opened) {
      setIsReadingSummary(false);
      setIsSummaryPaused(false);
      AudioManager.getInstance().stopSpeaking();
    }
  }, [opened]);

  const formatForWhatsApp = (content: string) => {
    // Format the content in a WhatsApp-friendly way with emojis
    return `📱 *CoChat Summary*\n\n${content.split('\n').map(line => {
      // Add emojis based on line content
      if (line.toLowerCase().includes('summary')) return `📝 ${line}`;
      if (line.toLowerCase().includes('conclusion')) return `✅ ${line}`;
      if (line.toLowerCase().includes('key point')) return `🔑 ${line}`;
      if (line.toLowerCase().includes('insight')) return `💡 ${line}`;
      return `➡️ ${line}`;
    }).join('\n')}`;
  };

  const handleWhatsAppShare = () => {
    const formattedContent = formatForWhatsApp(summaryContent);
    setWhatsAppContent(formattedContent);
    setShowWhatsAppPreview(true);
  };

  return (
    <>
      <Modal 
        opened={opened} 
        onClose={() => {
          if (isReading) {
            AudioManager.getInstance().stopSpeaking();
            setIsReading(false);
            setIsPaused(false);
            setCurrentReadingIndex(-1);
          }
          onClose();
        }}
        title={<Text size="xl" fw={700}>Conversation Summary</Text>}
        size="xl"
        styles={{
          body: {
            maxHeight: 'calc(90vh - 100px)',
            overflowY: 'auto'
          }
        }}
      >
        <Stack gap="md">
          <Group>
            <Select
              label="Summary Type"
              data={[
                { value: 'concise', label: 'Concise' },
                { value: 'whatsapp', label: 'WhatsApp Style' },
                { value: 'detailed', label: 'Detailed Report' }
              ]}
              value={summaryType}
              onChange={(value) => setSummaryType(value as string)}
              style={{ minWidth: 200 }}
            />
            <Select
              label="Model"
              data={models.map(model => ({
                value: model.id,
                label: model.name
              }))}
              value={selectedModel}
              onChange={(value) => setSelectedModel(value)}
              style={{ minWidth: 200 }}
            />
          </Group>

          {error && (
            <Alert color="red" title="Error">
              {error}
            </Alert>
          )}

          {(isReading || isGenerating) && (
            <Paper p="xl" withBorder style={{ 
              backgroundColor: 'var(--mantine-color-dark-6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '1rem'
            }}>
              <Loader size="sm" color="teal" />
              <Text>
                {isReading 
                  ? `Reading ${conversations[currentReadingIndex]?.assistantName || 'Assistant'}'s conversation${isPaused ? ' (Paused)' : ''}`
                  : `Generating ${
                      summaryType === 'concise' ? 'concise summary' : 
                      summaryType === 'whatsapp' ? 'WhatsApp-style summary' :
                      'detailed report'
                    }...`
                }
              </Text>
            </Paper>
          )}

          {summaryContent && (
            <Paper p="xl" withBorder>
              <ScrollArea h={400} type="auto" scrollbarSize={8} scrollHideDelay={500} viewportRef={(viewport) => {
                if (viewport && isGenerating) {
                  viewport.scrollTop = viewport.scrollHeight;
                }
              }}>
                <Text style={{ whiteSpace: 'pre-wrap' }}>
                  {summaryContent}
                </Text>
              </ScrollArea>
              <Group mt="md" gap="xs">
                <Button
                  variant="light"
                  color={isReadingSummary ? (isSummaryPaused ? "yellow" : "red") : "blue"}
                  leftSection={
                    isReadingSummary ? 
                      (isSummaryPaused ? <IconPlayerPlay size={16} /> : <IconPlayerPause size={16} />) : 
                      <IconHeadphones size={16} />
                  }
                  onClick={handleReadSummary}
                  disabled={isGenerating}
                >
                  {isReadingSummary ? 
                    (isSummaryPaused ? "Resume Reading" : "Pause Reading") : 
                    "Read Summary"
                  }
                </Button>
                <CopyButton value={summaryContent}>
                  {({ copied, copy }) => (
                    <Button 
                      color={copied ? 'teal' : 'blue'} 
                      onClick={copy}
                      leftSection={copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                      variant="light"
                    >
                      {copied ? 'Copied' : 'Copy'}
                    </Button>
                  )}
                </CopyButton>
                <Button
                  variant="light"
                  leftSection={<IconPdf size={16} />}
                  onClick={async () => {
                    try {
                      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/v1/export/pdf`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ content: summaryContent })
                      });

                      if (!response.ok) {
                        throw new Error('Failed to generate PDF');
                      }

                      const blob = await response.blob();
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `conversation_summary_${new Date().toISOString().split('T')[0]}.pdf`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                    } catch (error) {
                      console.error('Error generating PDF:', error);
                      setError('Failed to generate PDF. Please try again.');
                    }
                  }}
                >
                  Save as PDF
                </Button>
                <Button
                  variant="light"
                  leftSection={<IconBrandWhatsapp size={16} />}
                  onClick={handleWhatsAppShare}
                >
                  Preview for WhatsApp
                </Button>
                <Button
                  variant="light"
                  leftSection={<IconFileText size={16} />}
                  onClick={() => {
                    const blob = new Blob([summaryContent], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `summary_${new Date().toISOString().slice(0,10)}.txt`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  }}
                >
                  Save as Text
                </Button>
              </Group>
            </Paper>
          )}

          <Group gap="md">
            <Button
              onClick={readPanelMessages}
              leftSection={<IconHeadphones size={16} />}
              loading={isReading}
              disabled={isGenerating}
            >
              Read Messages
            </Button>
            <Button
              onClick={generateSummary}
              leftSection={<IconFileText size={16} />}
              loading={isGenerating}
              disabled={isReading}
            >
              Generate Summary
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={showWhatsAppPreview}
        onClose={() => setShowWhatsAppPreview(false)}
        title={<Group><IconBrandWhatsapp size={20} /><Text>WhatsApp Preview</Text></Group>}
        size="lg"
      >
        <Stack gap="md">
          <Paper p="md" withBorder style={{ 
            backgroundColor: '#DCF8C6', 
            color: '#000',
            fontFamily: 'sans-serif',
            whiteSpace: 'pre-wrap',
            maxHeight: '400px',
            overflow: 'auto'
          }}>
            <Text style={{ whiteSpace: 'pre-wrap' }}>{whatsAppContent}</Text>
          </Paper>
          
          <Text size="sm" c="dimmed">
            The content has been formatted for WhatsApp with emojis and proper formatting.
            Copy the text and paste it into WhatsApp.
          </Text>

          <Group>
            <CopyButton value={whatsAppContent}>
              {({ copied, copy }) => (
                <Button
                  color={copied ? 'teal' : 'blue'}
                  onClick={copy}
                  leftSection={copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                >
                  {copied ? 'Copied!' : 'Copy to Clipboard'}
                </Button>
              )}
            </CopyButton>
            <Button variant="light" onClick={() => setShowWhatsAppPreview(false)}>
              Close Preview
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
} 