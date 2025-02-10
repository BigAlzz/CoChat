import { useState } from 'react'
import { MantineProvider, AppShell, Box, Text, ActionIcon, Button, SimpleGrid, createTheme, Select } from '@mantine/core'
import { IconSettings, IconPlus } from '@tabler/icons-react'
import ChatPanel from './components/ChatPanel'
import SettingsPanel from './components/SettingsPanel'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import '@mantine/core/styles.css'

const queryClient = new QueryClient()

const theme = createTheme({
  primaryColor: 'green',
});

type ChatMode = 'individual' | 'sequential' | 'parallel' | 'iteration';

interface ChatPanelConfig {
  id: string;
  title: string;
}

const MAX_PANELS = 6;

function App() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [chatPanels, setChatPanels] = useState<ChatPanelConfig[]>([
    { id: '1', title: 'Panel 1' }
  ]);
  const [chatMode, setChatMode] = useState<ChatMode>('individual');
  const [iterationCycles, setIterationCycles] = useState(1);
  const [currentCycle, setCurrentCycle] = useState(0);
  const [currentIterationPanel, setCurrentIterationPanel] = useState(0);

  const addChatPanel = () => {
    if (chatPanels.length >= MAX_PANELS) return;
    
    const newPanelNumber = chatPanels.length + 1;
    setChatPanels([
      ...chatPanels,
      { id: newPanelNumber.toString(), title: `Panel ${newPanelNumber}` }
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

  const handleModeChange = (value: string | null) => {
    if (value && (value === 'individual' || value === 'sequential' || value === 'parallel' || value === 'iteration')) {
      // Clear any existing state from previous mode
      setCurrentCycle(0);
      setCurrentIterationPanel(0);
      
      // Update the mode
      setChatMode(value);
      
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
      notification.textContent = `Switched to ${value} mode`;
      
      document.body.appendChild(notification);
      setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transition = 'opacity 0.5s ease-out';
        setTimeout(() => document.body.removeChild(notification), 500);
      }, 2000);
    }
  };

  const handleSequentialMessage = (panelIndex: number, message: string) => {
    if (chatMode === 'sequential' && panelIndex < chatPanels.length - 1) {
      // Handle sequential mode
      const nextPanelIndex = panelIndex + 1;
      const nextPanel = document.querySelector(
        `[data-panel-index="${nextPanelIndex}"]`
      );
      
      if (nextPanel) {
        const messageInput = nextPanel.querySelector('.message-input');
        const modelSelected = nextPanel.querySelector('.model-selector input')?.getAttribute('value');
        
        if (messageInput && modelSelected) {
          const event = new CustomEvent('sequential-message', { 
            detail: { message },
            bubbles: true 
          });
          messageInput.dispatchEvent(event);
        } else {
          setTimeout(() => handleSequentialMessage(panelIndex, message), 500);
        }
      }
    } else if (chatMode === 'iteration') {
      // Handle iteration mode
      const nextPanelIndex = (panelIndex + 1) % chatPanels.length;
      
      // If we've completed a cycle and there are more cycles to go
      if (nextPanelIndex === 0 && currentCycle + 1 < iterationCycles) {
        setCurrentCycle(prev => prev + 1);
      }
      
      // Continue to next panel if we haven't completed all cycles
      if (!(nextPanelIndex === 0 && currentCycle + 1 >= iterationCycles)) {
        const nextPanel = document.querySelector(
          `[data-panel-index="${nextPanelIndex}"]`
        );
        
        if (nextPanel) {
          const messageInput = nextPanel.querySelector('.message-input');
          const modelSelected = nextPanel.querySelector('.model-selector input')?.getAttribute('value');
          
          if (messageInput && modelSelected) {
            const event = new CustomEvent('sequential-message', { 
              detail: { message },
              bubbles: true 
            });
            messageInput.dispatchEvent(event);
          } else {
            setTimeout(() => handleSequentialMessage(panelIndex, message), 500);
          }
        }
      }
      
      setCurrentIterationPanel(nextPanelIndex);
    }
  };

  const handleParallelMessage = (sourceIndex: number, message: string) => {
    if (chatMode === 'parallel') {
      // Send the message to all other panels
      chatPanels.forEach((_, index) => {
        if (index !== sourceIndex) {  // Don't send back to source panel
          const panel = document.querySelector(
            `[data-panel-index="${index}"]`
          );
          
          if (panel) {
            const messageInput = panel.querySelector('.message-input');
            const modelSelected = panel.querySelector('.model-selector input')?.getAttribute('value');
            
            if (messageInput && modelSelected) {
              const event = new CustomEvent('parallel-message', { 
                detail: { message },
                bubbles: true 
              });
              messageInput.dispatchEvent(event);
            }
          }
        }
      });
    }
  };

  return (
    <QueryClientProvider client={queryClient}>
      <MantineProvider theme={theme} defaultColorScheme="dark">
        <AppShell
          header={{ height: 60 }}
          padding="md"
          style={{ backgroundColor: '#1a1b1e' }}
        >
          <AppShell.Header style={{ 
            backgroundColor: '#25262b', 
            borderBottom: '1px solid #2c2e33',
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 100
          }}>
            <Box p="xs" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <Text size="xl" fw={700} style={{ color: '#39ff14' }}>
                  CoChat
                </Text>
                <Button
                  variant="light"
                  size="sm"
                  leftSection={<IconPlus size={16} />}
                  onClick={addChatPanel}
                  style={{ marginLeft: '1rem' }}
                  disabled={chatPanels.length >= MAX_PANELS}
                >
                  Add Panel {chatPanels.length}/{MAX_PANELS}
                </Button>
                <Select
                  value={chatMode}
                  onChange={handleModeChange}
                  data={[
                    { value: 'individual', label: 'Individual Mode' },
                    { value: 'sequential', label: 'Sequential Mode' },
                    { value: 'parallel', label: 'Parallel Mode' },
                    { value: 'iteration', label: 'Iteration Mode' }
                  ]}
                  style={{ 
                    width: '180px',
                    marginLeft: '1rem'
                  }}
                  placeholder="Select Mode"
                />
                {chatMode === 'iteration' && (
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={iterationCycles}
                    onChange={(e) => setIterationCycles(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                    style={{
                      width: '60px',
                      marginLeft: '0.5rem',
                      padding: '0.25rem',
                      backgroundColor: '#25262b',
                      border: '1px solid #2c2e33',
                      color: '#e0e0e0',
                      borderRadius: '4px'
                    }}
                    placeholder="Cycles"
                  />
                )}
              </Box>
              <ActionIcon 
                variant="light" 
                onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                style={{ 
                  color: '#39ff14',
                  border: '1px solid #39ff14'
                }}
              >
                <IconSettings size={20} />
              </ActionIcon>
            </Box>
          </AppShell.Header>

          <AppShell.Main style={{ 
            paddingTop: '60px', // Account for fixed header
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <Box style={{ 
              position: 'relative',
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              height: 'calc(100vh - 60px)', // Full viewport height minus header
              backgroundColor: '#1a1b1e'
            }}>
              {isSettingsOpen && (
                <Box style={{ 
                  position: 'fixed',
                  top: 60,
                  left: 0,
                  width: '400px',
                  height: 'calc(100vh - 60px)',
                  backgroundColor: '#25262b',
                  borderRight: '1px solid #2c2e33',
                  boxShadow: '4px 0 10px rgba(0, 0, 0, 0.2)',
                  padding: '1rem',
                  zIndex: 10,
                  overflowY: 'auto'
                }}>
                  <SettingsPanel />
                </Box>
              )}

              <Box style={{ 
                marginLeft: isSettingsOpen ? '400px' : '0',
                transition: 'margin-left 0.3s ease-in-out',
                padding: '1rem',
                flex: 1,
                height: '100%',
                overflow: 'auto'
              }}>
                <SimpleGrid 
                  cols={{ 
                    base: 1, 
                    md: chatPanels.length <= 2 ? 2 : 3 
                  }} 
                  spacing="lg"
                >
                  {chatPanels.map((panel, index) => (
                    <Box 
                      key={panel.id} 
                      style={{ 
                        height: getPanelHeight(),
                        transition: 'height 0.3s ease-in-out'
                      }}
                      data-panel-index={index}
                    >
                      <ChatPanel
                        title={panel.title}
                        isAutonomous={chatMode !== 'individual'}
                        mode={chatMode}
                        onRemove={() => removeChatPanel(panel.id)}
                        panelIndex={index}
                        totalPanels={chatPanels.length}
                        onSequentialMessage={
                          (chatMode === 'sequential' || chatMode === 'iteration')
                            ? (message) => handleSequentialMessage(index, message)
                            : undefined
                        }
                        onParallelMessage={
                          chatMode === 'parallel'
                            ? (message) => handleParallelMessage(index, message)
                            : undefined
                        }
                        currentCycle={chatMode === 'iteration' ? currentCycle : undefined}
                      />
                    </Box>
                  ))}
                </SimpleGrid>
              </Box>
            </Box>
          </AppShell.Main>
        </AppShell>
      </MantineProvider>
    </QueryClientProvider>
  )
}

export default App
