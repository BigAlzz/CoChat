import { useState, useEffect, useRef } from 'react'
import { MantineProvider, AppShell, Box, Text, ActionIcon, Button, SimpleGrid, createTheme, Select, Group, Tooltip, Title, Loader, rem, NumberInput, Modal as MantineModal, Stack, Paper, ScrollArea, Alert, Menu, Badge, Tabs, Menu as ContextMenu } from '@mantine/core'
import { IconSettings, IconPlus, IconVolume, IconVolumeOff, IconMicrophone, IconFileAnalytics, IconArrowsShuffle, IconArrowsDiagonal2, IconRepeat, IconTrash, IconX, IconHistory, IconDownload, IconFileText, IconFileTypePdf, IconJson, IconInfoCircle } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import ChatPanel from './components/ChatPanel'
import { SettingsPanel } from './components/SettingsPanel'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import '@mantine/core/styles.css'
import SummaryModal from './components/SummaryModal'
import { useAudioStore } from './utils/audio'
import RecordedConversations from './components/RecordedConversations'
import VoiceSettings from './components/VoiceSettings'
import MessageInput from './components/MessageInput'

const queryClient = new QueryClient()

const theme = createTheme({
  primaryColor: 'teal',
  colors: {
    dark: [
      '#C1C2C5',
      '#A6A7AB',
      '#909296',
      '#5C5F66',
      '#373A40',
      '#2C2E33',
      '#25262B',
      '#1A1B1E',
      '#141517',
      '#101113',
    ],
    teal: [
      '#E6FFF9',
      '#B3FFE6',
      '#80FFD9',
      '#4DFFCC',
      '#1AFFBF',
      '#00B894',
      '#00A085',
      '#008C76',
      '#007867',
      '#006458',
    ],
  },
  primaryShade: { light: 6, dark: 5 },
  defaultRadius: 'md',
  black: '#1A1B1E',
  white: '#E0E0E0',
});

type ChatMode = 'individual' | 'sequential' | 'parallel' | 'cyclic';

interface ChatMessage {
  role: string;
  content: string;
  assistantName?: string;
  timestamp?: string;
}

interface ChatPanelConfig {
  id: string;
  title: string;
  layout: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
}

interface SavedChat {
  id: string;
  title: string;
  timestamp: string;
  messages: ChatMessage[];
  mode: ChatMode;
  panels: ChatPanelConfig[];
  firstQuestion: string;
}

const MAX_PANELS = 6;

// Add ModeAnimation component
const ModeAnimation = ({ mode, isActive }: { mode: string; isActive: boolean }) => {
  if (!isActive) return null;

  const getAnimation = () => {
    switch (mode) {
      case 'sequential':
        return (
          <Group gap="xs" align="center">
            <IconArrowsShuffle size={20} color="#39ff14" className="pulse-animation" />
            <Text size="sm" c="#39ff14">Sequential Mode Active</Text>
          </Group>
        );
      case 'parallel':
        return (
          <Group gap="xs" align="center">
            <IconArrowsDiagonal2 size={20} color="#39ff14" className="pulse-animation" />
            <Text size="sm" c="#39ff14">Parallel Mode Active</Text>
          </Group>
        );
      case 'cyclic':
        return (
          <Group gap="xs" align="center">
            <IconRepeat size={20} color="#39ff14" className="pulse-animation" />
            <Text size="sm" c="#39ff14">Cyclic Mode Active</Text>
          </Group>
        );
      default:
        return null;
    }
  };

  return (
    <Box 
      style={{ 
        animation: isActive ? 'fadeInOut 2s infinite' : 'none',
        padding: '4px 12px',
        borderRadius: '4px',
        backgroundColor: 'rgba(57, 255, 20, 0.1)'
      }}
    >
      {getAnimation()}
    </Box>
  );
};

function App() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [chatPanels, setChatPanels] = useState<ChatPanelConfig[]>([
    { id: '1', title: 'Panel 1', layout: { x: 0, y: 0, w: 1, h: 1 } }
  ]);
  const [chatMode, setChatMode] = useState<ChatMode>('individual');
  const [iterationCycles, setIterationCycles] = useState(1);
  const [currentCycle, setCurrentCycle] = useState(0);
  const [currentIterationPanel, setCurrentIterationPanel] = useState(0);
  const [showSummary, setShowSummary] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<Array<{
    role: string;
    content: string;
    assistantName?: string;
    timestamp?: string;
  }>>([]);
  const [recordSequentialConversations, setRecordSequentialConversations] = useState(false);
  const { isMuted, toggleMute } = useAudioStore();
  const [showRecordings, setShowRecordings] = useState(false);
  const [models, setModels] = useState<Array<{ id: string; name: string }>>([]);
  const [voiceSettingsOpened, setVoiceSettingsOpened] = useState(false);
  const [isModeActive, setIsModeActive] = useState(false);
  const [completionSound, setCompletionSound] = useState<string | null>(
    localStorage.getItem('completionSoundUrl')
  );
  const [showIterationConfig, setShowIterationConfig] = useState(false);
  const [maxCycles, setMaxCycles] = useState(3);
  const [completedPanels, setCompletedPanels] = useState(0);
  const [lastSelectedModel, setLastSelectedModel] = useState<{
    modelId: string;
    role: string;
    posture: string;
  } | null>(null);
  const [savedChats, setSavedChats] = useState<SavedChat[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [showChatHistory, setShowChatHistory] = useState(false);
  const [selectedHistoryChat, setSelectedHistoryChat] = useState<SavedChat | null>(null);
  const [isCyclicActive, setIsCyclicActive] = useState(false);
  const lastCyclicResponse = useRef<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  const addChatPanel = () => {
    if (chatPanels.length >= MAX_PANELS) return;
    
    const newPanelNumber = chatPanels.length + 1;
    const lastPanel = chatPanels[chatPanels.length - 1];
    
    // Clone voice settings from the last panel if it exists
    if (lastPanel) {
      const lastPanelId = lastPanel.id;
      const newPanelId = newPanelNumber.toString();
      useAudioStore.getState().cloneSettings(lastPanelId, newPanelId);
    }
    
    setChatPanels([
      ...chatPanels,
      { id: newPanelNumber.toString(), title: `Panel ${newPanelNumber}`, layout: { x: 0, y: 0, w: 1, h: 1 } }
    ]);
  };

  const removeChatPanel = (panelId: string) => {
    setChatPanels(panels => panels.filter(panel => panel.id !== panelId));
  };

  // Calculate panel height based on number of panels
  const getPanelHeight = () => {
    const panelCount = chatPanels.length;
    if (panelCount <= 3) return 'calc(100vh - 120px)';  // Full height for 1-3 panels
    return 'calc(50vh - 60px)';                         // Half height for 4-6 panels
  };

  // Reset completed panels when mode changes
  useEffect(() => {
    setCompletedPanels(0);
    setCurrentCycle(0);
  }, [chatMode]);

  // Handle mode animation and completion sound
  const handleFirstModelResponse = (isStarting: boolean) => {
    if (chatMode !== 'individual') {
      setIsModeActive(isStarting);
    }
  };

  // Handle panel completion and play sound
  const handlePanelComplete = (panelIndex: number) => {
    const isLastPanel = panelIndex === chatPanels.length - 1;
    
    // Keep animation active until the last panel completes
    if (chatMode !== 'individual' && !isLastPanel) {
      setIsModeActive(true);
    } else {
      setIsModeActive(false);
    }

    const shouldPlaySound = !isMuted && completionSound && (
      chatMode === 'individual' ||
      (chatMode === 'sequential' && isLastPanel) ||
      (chatMode === 'parallel' && panelIndex === chatPanels.length - 1) ||
      (chatMode === 'cyclic' && isLastPanel && currentCycle === maxCycles - 1)
    );

    if (shouldPlaySound) {
      const audio = new Audio(completionSound);
      audio.play().catch(error => {
        console.error('Error playing completion sound:', error);
      });
    }

    // Handle mode-specific completion logic
    switch (chatMode) {
      case 'sequential':
        // Check if all panels have been used
        const allPanelsUsed = Array.from(document.querySelectorAll('[data-panel-index]'))
          .every(panel => panel.hasAttribute('data-sequential-used'));
        if (allPanelsUsed) {
          setIsModeActive(false);
          // Clear sequential-used markers when all panels are done
          document.querySelectorAll('[data-sequential-used]').forEach(panel => {
            panel.removeAttribute('data-sequential-used');
          });
        }
        break;

      case 'parallel':
        setCompletedPanels(prev => {
          const newCount = prev + 1;
          if (newCount === chatPanels.length) {
            setIsModeActive(false);
          }
          return newCount;
        });
        break;

      case 'cyclic':
        if (isCyclicActive && isLastPanel) {
          if (currentCycle + 1 < maxCycles && lastCyclicResponse.current) {
            // Reset per-panel state for the new cycle
            document.querySelectorAll('[data-sequential-used]').forEach(panel => {
              panel.removeAttribute('data-sequential-used');
            });
            setCurrentCycle(prev => prev + 1);
            // Trigger the first panel with the last response
            const event = new CustomEvent('sequential-message', {
              detail: {
                message: lastCyclicResponse.current,
                role: lastSelectedModel?.role,
                posture: lastSelectedModel?.posture
              }
            });
            const firstPanel = document.querySelector('[data-panel-index="0"]');
            if (firstPanel) {
              firstPanel.dispatchEvent(event);
            }
          } else {
            setIsCyclicActive(false); // Stop after max cycles
          }
        }
        break;
    }
  };

  const handleModeChange = (value: string | null) => {
    if (value && (value === 'individual' || value === 'sequential' || value === 'cyclic')) {
      // Clear any existing state from previous mode
      setCurrentCycle(0);
      setCurrentIterationPanel(0);
      setIsModeActive(false);
      setCompletedPanels(0);
      
      // Remove any sequential-used markers
      document.querySelectorAll('[data-sequential-used]').forEach(panel => {
        panel.removeAttribute('data-sequential-used');
      });
      
      // Show iteration config modal if cyclic mode selected
      if (value === 'cyclic') {
        setShowIterationConfig(true);
      }
      
      // Update the mode
      setChatMode(value as ChatMode);
      
      // Show a notification about mode change
      const modeDescriptions = {
        individual: 'Individual panel mode',
        sequential: 'Sequential mode - each panel responds once',
        cyclic: `Cyclic mode - ${maxCycles} rounds through all panels`
      };
      
      notifications.show({
        title: 'Mode Changed',
        message: modeDescriptions[value as keyof typeof modeDescriptions],
        color: 'teal'
      });
    }
    if (value === 'cyclic') {
      setIsCyclicActive(true);
    } else {
      setIsCyclicActive(false);
    }
  };

  const handleSequentialMessage = (message: string) => {
    // Find the next panel's index that hasn't been used yet
    const nextPanelIndex = chatPanels.findIndex((panel, index) => {
      const panelElement = document.querySelector(`[data-panel-index="${index}"]`);
      return panelElement?.getAttribute('data-panel-state') === 'ready' && 
             !panelElement?.hasAttribute('data-sequential-used');
    });

    if (nextPanelIndex !== -1) {
      const nextPanel = document.querySelector(`[data-panel-index="${nextPanelIndex}"]`);
      if (nextPanel) {
        // Mark this panel as used in the sequential flow BEFORE dispatching
        nextPanel.setAttribute('data-sequential-used', 'true');
        // Create and dispatch the sequential message event
        const event = new CustomEvent('sequential-message', {
          detail: {
            message,
            role: lastSelectedModel?.role,
            posture: lastSelectedModel?.posture
          }
        });
        nextPanel.dispatchEvent(event);
      }
    }
  };

  const handleParallelMessage = (message: string) => {
    // Send the message to all panels
    let missingModelPanels = 0;
    chatPanels.forEach((_, index) => {
      const panelElement = document.querySelector(`[data-panel-index="${index}"]`);
      if (panelElement && panelElement.getAttribute('data-panel-state') === 'ready') {
        const event = new CustomEvent('parallel-message', {
          detail: {
            message,
            role: lastSelectedModel?.role,
            posture: lastSelectedModel?.posture
          }
        });
        panelElement.dispatchEvent(event);
        console.log(`Dispatched parallel-message to panel ${index}`);
      } else {
        missingModelPanels++;
      }
    });
    if (missingModelPanels > 0) {
      notifications.show({
        title: 'Warning',
        message: `${missingModelPanels} panel(s) do not have a model selected and will not respond.`,
        color: 'yellow',
      });
    }
  };

  const handleIterationMessage = (message: string) => {
    // Find the next panel in the cycle
    const nextPanelIndex = (currentIterationPanel + 1) % chatPanels.length;
    
    // Create and dispatch the sequential message event
    const event = new CustomEvent('sequential-message', {
      detail: {
        message,
        role: lastSelectedModel?.role,
        posture: lastSelectedModel?.posture
      }
    });

    const nextPanel = document.querySelector(`[data-panel-index="${nextPanelIndex}"]`);
    if (nextPanel) {
      nextPanel.dispatchEvent(event);
      setCurrentIterationPanel(nextPanelIndex);

      // If we've completed a cycle
      if (nextPanelIndex === chatPanels.length - 1) {
        if (currentCycle < maxCycles - 1) {
          setCurrentCycle(prev => prev + 1);
        }
      }
    }
  };

  const handleRecordMessage = (message: string, role: string, assistantName?: string) => {
    const newMessage = {
      role,
      content: message,
      assistantName,
      timestamp: new Date().toISOString()
    };
    setConversationHistory(prev => [...prev, newMessage]);
  };

  const handleExport = async (format: string, content: string) => {
    try {
      if (format === 'markdown') {
        // Create a blob with the content
        const blob = new Blob([content], { type: 'text/markdown' });
        const url = window.URL.createObjectURL(blob);
        
        // Create a temporary link and trigger download
        const link = document.createElement('a');
        link.href = url;
        link.download = `conversation_summary_${new Date().toISOString().split('T')[0]}.md`;
        document.body.appendChild(link);
        link.click();
        
        // Clean up
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      } else if (format === 'pdf') {
        // Send request to backend to generate PDF
        const response = await fetch('/api/v1/export/pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content }),
        });
        
        if (!response.ok) {
          throw new Error('Failed to generate PDF');
        }
        
        // Get the PDF blob from response
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        
        // Create a temporary link and trigger download
        const link = document.createElement('a');
        link.href = url;
        link.download = `conversation_summary_${new Date().toISOString().split('T')[0]}.pdf`;
        document.body.appendChild(link);
        link.click();
        
        // Clean up
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Error exporting file:', error);
      // You might want to show a notification to the user here
    }
  };

  // Load saved chats on mount
  useEffect(() => {
    const loadedChats = localStorage.getItem('saved_chats');
    if (loadedChats) {
      setSavedChats(JSON.parse(loadedChats));
    }
  }, []);

  // Save current chat with first question as title
  const saveCurrentChat = () => {
    if (conversationHistory.length === 0) return;

    // Find the first user message to use as the chat title
    const firstUserMessage = conversationHistory.find(msg => msg.role === 'user');
    if (!firstUserMessage) return;

    // Create a shortened version of the first question for the title
    const shortTitle = firstUserMessage.content.length > 50 
      ? firstUserMessage.content.substring(0, 50) + '...'
      : firstUserMessage.content;

    const newChat: SavedChat = {
      id: Date.now().toString(),
      title: shortTitle,
      timestamp: new Date().toISOString(),
      messages: conversationHistory,
      mode: chatMode,
      panels: chatPanels,
      firstQuestion: firstUserMessage.content
    };

    const updatedChats = [...savedChats, newChat];
    setSavedChats(updatedChats);
    localStorage.setItem('saved_chats', JSON.stringify(updatedChats));
  };

  // Load a saved chat
  const loadSavedChat = (chatId: string) => {
    const chat = savedChats.find(c => c.id === chatId);
    if (chat) {
      setChatMode(chat.mode);
      setChatPanels(chat.panels);
      setConversationHistory(chat.messages);
      setSelectedChatId(chatId);
      setShowChatHistory(false); // Close the modal after loading
    }
  };

  // Delete a saved chat
  const deleteSavedChat = (chatId: string) => {
    const updatedChats = savedChats.filter(chat => chat.id !== chatId);
    setSavedChats(updatedChats);
    localStorage.setItem('saved_chats', JSON.stringify(updatedChats));
    if (selectedHistoryChat?.id === chatId) {
      setSelectedHistoryChat(null);
    }
  };

  // Format timestamp
  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  // Auto-save chat when messages change
  useEffect(() => {
    if (conversationHistory.length > 0) {
      saveCurrentChat();
    }
  }, [conversationHistory]);

  // Add export functions
  const exportChatAsPDF = async (chat: SavedChat) => {
    try {
      // Convert chat messages to formatted text
      const content = chat.messages.map(msg => 
        `${msg.role === 'user' ? 'You' : msg.assistantName || 'Assistant'}: ${msg.content}`
      ).join('\n\n');

      const response = await fetch('/api/v1/export/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      
      if (!response.ok) throw new Error('Failed to generate PDF');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `chat_${chat.id}_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting PDF:', error);
    }
  };

  const exportChatAsText = (chat: SavedChat) => {
    try {
      const content = chat.messages.map(msg => 
        `${msg.role === 'user' ? 'You' : msg.assistantName || 'Assistant'} (${new Date(msg.timestamp || '').toLocaleString()}):\n${msg.content}`
      ).join('\n\n');

      const blob = new Blob([content], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `chat_${chat.id}_${new Date().toISOString().split('T')[0]}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting text:', error);
    }
  };

  const exportChatAsJSON = (chat: SavedChat) => {
    try {
      const blob = new Blob([JSON.stringify(chat, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `chat_${chat.id}_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting JSON:', error);
    }
  };

  // In the ChatPanel onModelResponse or onPanelComplete, store the last response for cyclic mode
  const handleCyclicMessage = (message: string) => {
    lastCyclicResponse.current = message;
  };

  // Add a handler for sending messages from the top-level input
  const handleUserSend = (message: string) => {
    if (chatMode === 'parallel') {
      handleParallelMessage(message);
    } else if (chatMode === 'sequential') {
      // Only send to the first panel
      const panelElement = document.querySelector('[data-panel-index="0"]');
      if (panelElement) {
        const event = new CustomEvent('sequential-message', {
          detail: {
            message,
            role: lastSelectedModel?.role,
            posture: lastSelectedModel?.posture
          }
        });
        panelElement.dispatchEvent(event);
      }
    } else if (chatMode === 'cyclic') {
      handleSequentialMessage(message); // or handleCyclicMessage for cyclic if needed
    } else {
      // For individual mode, send to the first (or active) panel
      const panelElement = document.querySelector('[data-panel-index="0"]');
      if (panelElement) {
        const event = new CustomEvent('sequential-message', {
          detail: {
            message,
            role: lastSelectedModel?.role,
            posture: lastSelectedModel?.posture
          }
        });
        panelElement.dispatchEvent(event);
      }
    }
  };

  return (
    <QueryClientProvider client={queryClient}>
      <MantineProvider 
        theme={theme}
        defaultColorScheme="dark"
      >
        <AppShell
          header={{ height: 60 }}
          padding="md"
        >
          <AppShell.Header>
            <Group justify="space-between" h="100%" px="md">
              <Title order={3}>CoChat</Title>
              <Group align="center" gap="lg">
                <ModeAnimation mode={chatMode} isActive={isModeActive} />
                {chatMode === 'cyclic' && (
                  <Text size="sm" c="dimmed">
                    Cycle {currentCycle + 1} of {maxCycles}
                  </Text>
                )}
                <Group>
                  <Tooltip label={isMuted ? "Unmute" : "Mute"}>
                    <ActionIcon variant="light" onClick={toggleMute}>
                      {isMuted ? <IconVolumeOff size={20} /> : <IconVolume size={20} />}
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="Generate Summary">
                    <ActionIcon variant="light" onClick={() => setShowSummary(true)}>
                      <IconFileAnalytics size={20} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="Help & User Guide">
                    <ActionIcon variant="light" onClick={() => setHelpOpen(true)}>
                      <IconInfoCircle size={20} />
                    </ActionIcon>
                  </Tooltip>
                  <Select
                    placeholder="Previous Chats"
                    data={savedChats.map(chat => ({
                      value: chat.id,
                      label: chat.title
                    }))}
                    value={selectedChatId}
                    onChange={(value) => value && loadSavedChat(value)}
                    clearable
                    style={{ width: '200px' }}
                  />
                  <Tooltip label="Chat History">
                    <ActionIcon variant="light" onClick={() => setShowChatHistory(true)}>
                      <IconHistory size={20} />
                    </ActionIcon>
                  </Tooltip>
                  <Select
                    data={[
                      { value: 'individual', label: 'Individual' },
                      { value: 'sequential', label: 'Sequential (Once through all panels)' },
                      { value: 'cyclic', label: 'Cyclic (Multiple rounds)' }
                    ]}
                    value={chatMode}
                    onChange={handleModeChange}
                    placeholder="Select mode"
                  />
                  <Button
                    variant="light"
                    leftSection={<IconPlus size={20} />}
                    onClick={addChatPanel}
                    disabled={chatPanels.length >= MAX_PANELS}
                  >
                    Add Panel
                  </Button>
                  <ActionIcon variant="light" onClick={() => setIsSettingsOpen(true)}>
                    <IconSettings size={20} />
                  </ActionIcon>
                </Group>
              </Group>
            </Group>
          </AppShell.Header>

          <AppShell.Main>
            {/* Place MessageInput at the top */}
            <Box style={{ padding: '1rem', background: 'var(--surface-color)' }}>
              <MessageInput
                onSend={handleUserSend}
                disabled={false}
                // Add any other props as needed
              />
            </Box>
            <Box style={{ display: 'flex', flexDirection: 'row', width: '100%', height: '100%' }}>
              {chatPanels.map((panel, index) => (
                <Box key={panel.id} h={getPanelHeight()} style={{ flex: `0 0 ${100 / chatPanels.length}%`, maxWidth: `${100 / chatPanels.length}%`, minWidth: 0, boxSizing: 'border-box', height: '100%' }}>
                  <ChatPanel
                    title={`Panel ${panel.id}`}
                    isAutonomous={false}
                    mode={chatMode}
                    onRemove={() => removeChatPanel(panel.id)}
                    panelIndex={index}
                    totalPanels={chatPanels.length}
                    onSequentialMessage={chatMode === 'cyclic' ? handleCyclicMessage : handleSequentialMessage}
                    onParallelMessage={handleParallelMessage}
                    currentCycle={currentCycle}
                    onRecordMessage={handleRecordMessage}
                    recordSequentialConversation={recordSequentialConversations}
                    onModelResponse={index === 0 ? handleFirstModelResponse : undefined}
                    onPanelComplete={handlePanelComplete}
                    maxCycles={maxCycles}
                    initialModel={lastSelectedModel}
                    onModelSelect={(modelId, role, posture) => {
                      setLastSelectedModel({ modelId, role, posture });
                    }}
                  />
                </Box>
              ))}
            </Box>
          </AppShell.Main>
        </AppShell>

        <SettingsPanel 
          opened={isSettingsOpen} 
          onClose={() => setIsSettingsOpen(false)}
          models={models}
        />
        <SummaryModal
          opened={showSummary}
          onClose={() => setShowSummary(false)}
          conversations={conversationHistory}
          onExport={handleExport}
        />
        <RecordedConversations
          opened={showRecordings}
          onClose={() => setShowRecordings(false)}
        />
        <VoiceSettings
          opened={voiceSettingsOpened}
          onClose={() => setVoiceSettingsOpened(false)}
        />

        <MantineModal
          opened={showIterationConfig}
          onClose={() => setShowIterationConfig(false)}
          title="Configure Iteration Mode"
          size="sm"
        >
          <Stack gap="md">
            <NumberInput
              label="Number of Cycles"
              description="How many times should the conversation iterate through all panels"
              value={maxCycles}
              onChange={(value) => setMaxCycles(Number(value))}
              min={1}
              max={10}
              step={1}
            />
            <Button onClick={() => setShowIterationConfig(false)}>
              Start Iteration
            </Button>
          </Stack>
        </MantineModal>

        {/* Chat History Modal */}
        <MantineModal
          opened={showChatHistory}
          onClose={() => setShowChatHistory(false)}
          title={<Title order={3}>Chat History</Title>}
          size="xl"
        >
          <Stack gap="md">
            <Group gap="md" grow>
              {/* Chat List */}
              <Box style={{ flex: 1, maxHeight: '70vh', overflowY: 'auto' }}>
                <Stack gap="xs">
                  {savedChats.map(chat => (
                    <ContextMenu key={chat.id} position="bottom-start" offset={4}>
                      <ContextMenu.Target>
                        <Paper
                          p="md"
                          withBorder
                          style={{ 
                            cursor: 'pointer',
                            backgroundColor: selectedHistoryChat?.id === chat.id ? 'var(--mantine-color-dark-6)' : undefined
                          }}
                          onClick={() => setSelectedHistoryChat(chat)}
                        >
                          <Group justify="space-between" mb="xs">
                            <Text size="sm" fw={500}>{chat.title}</Text>
                            <Badge>{chat.mode}</Badge>
                          </Group>
                          <Text size="xs" c="dimmed">{formatTimestamp(chat.timestamp)}</Text>
                        </Paper>
                      </ContextMenu.Target>

                      <ContextMenu.Dropdown>
                        <ContextMenu.Label>Chat Options</ContextMenu.Label>
                        <ContextMenu.Item
                          color="red"
                          leftSection={<IconTrash size={14} />}
                          onClick={() => deleteSavedChat(chat.id)}
                        >
                          Delete Chat
                        </ContextMenu.Item>
                        <ContextMenu.Divider />
                        <ContextMenu.Label>Export As</ContextMenu.Label>
                        <ContextMenu.Item
                          leftSection={<IconFileTypePdf size={14} />}
                          onClick={() => exportChatAsPDF(chat)}
                        >
                          PDF
                        </ContextMenu.Item>
                        <ContextMenu.Item
                          leftSection={<IconFileText size={14} />}
                          onClick={() => exportChatAsText(chat)}
                        >
                          Text
                        </ContextMenu.Item>
                        <ContextMenu.Item
                          leftSection={<IconJson size={14} />}
                          onClick={() => exportChatAsJSON(chat)}
                        >
                          JSON
                        </ContextMenu.Item>
                      </ContextMenu.Dropdown>
                    </ContextMenu>
                  ))}
                </Stack>
              </Box>

              {/* Chat Details */}
              {selectedHistoryChat && (
                <Box style={{ flex: 1.5, maxHeight: '70vh' }}>
                  <Paper p="md" withBorder>
                    <Stack gap="md">
                      <Group justify="space-between">
                        <Title order={4}>{selectedHistoryChat.title}</Title>
                        <Button 
                          variant="light"
                          onClick={() => loadSavedChat(selectedHistoryChat.id)}
                        >
                          Load Chat
                        </Button>
                      </Group>
                      <Group>
                        <Badge>{selectedHistoryChat.mode} mode</Badge>
                        <Text size="sm">{formatTimestamp(selectedHistoryChat.timestamp)}</Text>
                      </Group>
                      <ScrollArea h={400}>
                        <Stack gap="md">
                          {selectedHistoryChat.messages.map((message, index) => (
                            <Paper
                              key={index}
                              p="md"
                              style={{
                                backgroundColor: message.role === 'user' 
                                  ? 'var(--mantine-color-dark-5)'
                                  : 'var(--mantine-color-dark-7)'
                              }}
                            >
                              <Group justify="space-between" mb="xs">
                                <Text size="sm" fw={500}>
                                  {message.role === 'user' ? 'You' : message.assistantName || 'Assistant'}
                                </Text>
                                <Text size="xs" c="dimmed">
                                  {message.timestamp && formatTimestamp(message.timestamp)}
                                </Text>
                              </Group>
                              <Text size="sm">{message.content}</Text>
                            </Paper>
                          ))}
                        </Stack>
                      </ScrollArea>
                    </Stack>
                  </Paper>
                </Box>
              )}
            </Group>
          </Stack>
        </MantineModal>

        {chatMode === 'cyclic' && isCyclicActive && (
          <Button color="red" onClick={() => setIsCyclicActive(false)} style={{ position: 'fixed', top: 16, right: 16, zIndex: 1000 }}>
            Stop Cycle
          </Button>
        )}

        {/* Global Help Modal */}
        <MantineModal
          opened={helpOpen}
          onClose={() => setHelpOpen(false)}
          title={<Group><IconInfoCircle size={22} /><Text>User Guide & Help</Text></Group>}
          size="xl"
          styles={{ body: { maxHeight: '80vh', overflowY: 'auto' } }}
        >
          <Stack gap="md">
            <Text size="lg" fw={700}>CoChat User Guide</Text>
            <Text>
{`
## Overview
CoChat is a multi-panel, multi-agent chat application designed for collaborative, comparative, and exploratory conversations with AI assistants. You can configure multiple panels, each with its own assistant, role, and posture, and run conversations in various modes (individual, sequential, parallel, cyclic). The app also features advanced summary generation and export options.

## Getting Started
1. **Launch the App:** Start the backend server and open the frontend in your browser.
2. **Add Panels:** Use the "Add Panel" button to create up to 6 panels. Each panel represents a separate AI assistant.
3. **Select Mode:** Choose a chat mode from the dropdown:
   - **Individual:** Each panel operates independently.
   - **Sequential:** The conversation flows from one panel to the next, each building on the previous response.
   - **Parallel:** All panels respond to the same prompt simultaneously.
   - **Cyclic:** The conversation cycles through all panels for multiple rounds.
4. **Configure Assistants:** For each panel, select a model, role, and posture. You can also set a custom voice for text-to-speech.
5. **Start Chatting:** Enter your message in the input box and send. The conversation will proceed according to the selected mode.
6. **Export & Summarize:** Use the summary and export features to generate concise, detailed, or WhatsApp-style summaries, and export conversations as text, PDF, or JSON.

## Chat Modes
- **Individual:** Each panel is independent. Useful for comparing different models or configurations.
- **Sequential:** The user's message is sent to the first panel; each subsequent panel receives the previous panel's response. Great for stepwise reasoning or multi-perspective analysis.
- **Parallel:** All panels receive the same user message and respond in parallel. Useful for side-by-side comparison.
- **Cyclic:** The conversation cycles through all panels for a set number of rounds, allowing for iterative, evolving discussions.

## Panels, Postures, and Roles
- **Panel:** A container for an AI assistant. Each panel can have its own model, role, and posture.
- **Role:** The "persona" or function of the assistant (e.g., Researcher, Mentor, Critic, Creative, Technical Expert).
- **Posture:** The communication style or attitude of the assistant (e.g., Concise, Empathetic, Analytical, Socratic, Creative, Professional).

### Example Roles
- **Researcher:** Focuses on evidence, sources, and thorough analysis.
- **Mentor:** Offers guidance, encouragement, and step-by-step help.
- **Critic:** Points out flaws, challenges assumptions, and provides counterarguments.
- **Creative:** Suggests novel ideas, brainstorming, and out-of-the-box thinking.
- **Technical Expert:** Delivers precise, technical, and detailed explanations.

### Example Postures
- **Concise:** Short, direct, and to the point.
- **Empathetic:** Supportive, understanding, and emotionally aware.
- **Analytical:** Breaks down problems, uses logic and structure.
- **Socratic:** Asks probing questions to stimulate critical thinking.
- **Creative:** Uses metaphors, analogies, and imaginative language.
- **Professional:** Formal, respectful, and business-like.

## How Postures and Roles Interact
The combination of role and posture defines each assistant's unique voice. Here are some examples:

- **Researcher + Analytical:** Provides in-depth, logical breakdowns with references to studies or data.
- **Mentor + Empathetic:** Offers step-by-step help with encouragement and emotional support.
- **Critic + Socratic:** Challenges ideas by asking thought-provoking questions, prompting deeper reflection.
- **Creative + Concise:** Delivers imaginative ideas in a punchy, memorable way.
- **Technical Expert + Professional:** Gives detailed, accurate answers in a formal, business-like tone.

### Example Interaction
Suppose you ask: "How can we improve team productivity?"
- **Panel 1 (Researcher + Analytical):** "Studies show that clear goals and regular feedback increase productivity by 20%. Consider implementing weekly check-ins and SMART objectives."
- **Panel 2 (Mentor + Empathetic):** "It's great that you care about your team's growth! Start by listening to their concerns and celebrating small wins together."
- **Panel 3 (Critic + Socratic):** "What do you think is currently holding your team back? Are there any processes that create bottlenecks?"
- **Panel 4 (Creative + Concise):** "Gamify tasks! Try a leaderboard or creative challenges to boost engagement."

## Summary Generation
CoChat offers advanced summary generation with three styles:
- **Concise:** A brief overview with key points and conclusions.
- **Detailed:** A blow-by-blow transcript, panel-by-panel, showing each assistant's contributions and all user/assistant turns in order. Ends with key discussion points and insights.
- **WhatsApp Style:** A fun, emoji-rich summary formatted for easy sharing.

To generate a summary:
1. Click the "Generate Summary" button.
2. Choose the summary type and model.
3. Wait for the summary to be generated (streamed in real time).
4. Export or copy the summary as needed.

## Tips and Best Practices
- Experiment with different combinations of roles and postures for richer discussions.
- Use sequential or cyclic modes for multi-step reasoning or iterative brainstorming.
- Export and review summaries to capture key insights and action items.
- Adjust the number of panels and cycles to fit your workflow.
`}
            </Text>
          </Stack>
        </MantineModal>

        <style>
          {`
            @keyframes fadeInOut {
              0% { opacity: 0.7; }
              50% { opacity: 1; }
              100% { opacity: 0.7; }
            }
            
            @keyframes pulse {
              0% { transform: scale(1); }
              50% { transform: scale(1.2); }
              100% { transform: scale(1); }
            }
            
            .pulse-animation {
              animation: pulse 2s infinite;
            }
          `}
        </style>
      </MantineProvider>
    </QueryClientProvider>
  );
}

export default App;
