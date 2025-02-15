import { useState, useEffect } from 'react'
import { MantineProvider, AppShell, Box, Text, ActionIcon, Button, SimpleGrid, createTheme, Select, Group, Tooltip, Title, Loader, rem, NumberInput, Modal as MantineModal, Stack } from '@mantine/core'
import { IconSettings, IconPlus, IconVolume, IconVolumeOff, IconMicrophone, IconFileAnalytics, IconArrowsShuffle, IconArrowsDiagonal2, IconRepeat, IconTrash, IconX } from '@tabler/icons-react'
import ChatPanel from './components/ChatPanel'
import { SettingsPanel } from './components/SettingsPanel'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import '@mantine/core/styles.css'
import SummaryModal from './components/SummaryModal'
import { useAudioStore } from './utils/audio'
import RecordedConversations from './components/RecordedConversations'
import VoiceSettings from './components/VoiceSettings'

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

type ChatMode = 'individual' | 'sequential' | 'parallel' | 'iteration';

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
      case 'iteration':
        return (
          <Group gap="xs" align="center">
            <IconRepeat size={20} color="#39ff14" className="pulse-animation" />
            <Text size="sm" c="#39ff14">Iteration Mode Active</Text>
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

  const addChatPanel = () => {
    if (chatPanels.length >= MAX_PANELS) return;
    
    const newPanelNumber = chatPanels.length + 1;
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
      (chatMode === 'iteration' && isLastPanel && currentCycle === maxCycles - 1)
    );

    if (shouldPlaySound) {
      const audio = new Audio(completionSound);
      audio.play().catch(error => {
        console.error('Error playing completion sound:', error);
      });
    }

    // Handle iteration mode cycle counting
    if (chatMode === 'iteration' && isLastPanel) {
      if (currentCycle < maxCycles - 1) {
        setCurrentCycle(prev => prev + 1);
      }
    }

    // Update completed panels count for parallel mode
    if (chatMode === 'parallel') {
      setCompletedPanels(prev => {
        const newCount = prev + 1;
        return newCount;
      });
    }
  };

  const handleModeChange = (value: string | null) => {
    if (value && (value === 'individual' || value === 'sequential' || value === 'parallel' || value === 'iteration')) {
      // Clear any existing state from previous mode
      setCurrentCycle(0);
      setCurrentIterationPanel(0);
      setIsModeActive(false);
      setCompletedPanels(0);
      
      // Show iteration config modal if iteration mode selected
      if (value === 'iteration') {
        setShowIterationConfig(true);
      }
      
      // Update the mode
      setChatMode(value as ChatMode);
      
      // Show a notification about mode change
      const notification = document.createElement('div');
      notification.style.position = 'fixed';
      notification.style.bottom = '20px';
      notification.style.right = '20px';
      notification.style.backgroundColor = '#39ff14';
      notification.style.color = 'black';
      notification.style.padding = '10px 20px';
      notification.style.borderRadius = '5px';
      notification.style.zIndex = '1000';
      notification.style.boxShadow = '0 0 10px rgba(57, 255, 20, 0.3)';
      notification.textContent = `Switched to ${value} mode${value === 'iteration' ? ` (${maxCycles} cycles)` : ''}`;
      
      document.body.appendChild(notification);
      setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transition = 'opacity 0.5s ease-out';
        setTimeout(() => document.body.removeChild(notification), 500);
      }, 2000);
    }
  };

  const handleSequentialMessage = (message: string) => {
    // Handle sequential message logic
    console.log('Sequential message:', message);
  };

  const handleParallelMessage = (message: string) => {
    // Handle parallel message logic
    console.log('Parallel message:', message);
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
                {chatMode === 'iteration' && (
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
                  <Select
                    data={[
                      { value: 'individual', label: 'Individual' },
                      { value: 'sequential', label: 'Sequential' },
                      { value: 'parallel', label: 'Parallel' },
                      { value: 'iteration', label: 'Iteration' }
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
            <SimpleGrid cols={chatPanels.length <= 3 ? chatPanels.length : 3}>
              {chatPanels.map((panel, index) => (
                <Box key={panel.id} h={getPanelHeight()}>
                  <ChatPanel
                    title={`Panel ${panel.id}`}
                    isAutonomous={false}
                    mode={chatMode}
                    onRemove={() => removeChatPanel(panel.id)}
                    panelIndex={index}
                    totalPanels={chatPanels.length}
                    onSequentialMessage={handleSequentialMessage}
                    onParallelMessage={handleParallelMessage}
                    currentCycle={currentCycle}
                    onRecordMessage={handleRecordMessage}
                    recordSequentialConversation={recordSequentialConversations}
                    onModelResponse={index === 0 ? handleFirstModelResponse : undefined}
                    onPanelComplete={handlePanelComplete}
                    maxCycles={maxCycles}
                  />
                </Box>
              ))}
            </SimpleGrid>
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
