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

type ChatMode = 'individual' | 'sequential' | 'parallel';

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
    if (value && (value === 'individual' || value === 'sequential' || value === 'parallel')) {
      setChatMode(value);
    }
  };

  const handleSequentialMessage = (panelIndex: number, message: string) => {
    if (chatMode === 'sequential' && panelIndex < chatPanels.length - 1) {
      // Find the next panel's ChatPanel component
      const nextPanel = document.querySelector(
        `[data-panel-index="${panelIndex + 1}"]`
      );
      
      if (nextPanel) {
        // Get the MessageInput component's onSend function
        const messageInput = nextPanel.querySelector('.message-input');
        if (messageInput) {
          // Directly call the handleSendMessage function on the ChatPanel
          const event = new CustomEvent('sequential-message', { 
            detail: { message },
            bubbles: true 
          });
          messageInput.dispatchEvent(event);
        }
      }
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
                    { value: 'parallel', label: 'Parallel Mode' }
                  ]}
                  style={{ 
                    width: '180px',
                    marginLeft: '1rem'
                  }}
                  placeholder="Select Mode"
                />
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
                          chatMode === 'sequential' 
                            ? (message) => handleSequentialMessage(index, message)
                            : undefined
                        }
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
