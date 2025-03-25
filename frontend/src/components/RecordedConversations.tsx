import { useState, useEffect } from 'react';
import { Modal, Button, Group, Text, Stack, Paper, ActionIcon, Menu, TextInput } from '@mantine/core';
import { IconDownload, IconTrash, IconDots, IconPencil, IconVolume, IconVolumeOff } from '@tabler/icons-react';
import { audioManager, useAudioStore } from '../utils/audio';

interface RecordedConversation {
  id: number;
  title: string;
  messages: Array<{
    role: string;
    content: string;
    assistantName?: string;
    timestamp: string;
  }>;
  date: string;
}

interface RecordedConversationsProps {
  opened: boolean;
  onClose: () => void;
}

const RecordedConversations = ({ opened, onClose }: RecordedConversationsProps) => {
  const [conversations, setConversations] = useState<RecordedConversation[]>([]);
  const [editingTitle, setEditingTitle] = useState<{ id: number; title: string } | null>(null);
  const [playingConversation, setPlayingConversation] = useState<number | null>(null);
  const { isMuted } = useAudioStore();

  useEffect(() => {
    if (opened) {
      const stored = localStorage.getItem('sequential_conversations');
      if (stored) {
        setConversations(JSON.parse(stored));
      }
    }
  }, [opened]);

  const handleDelete = (id: number) => {
    const updated = conversations.filter(conv => conv.id !== id);
    setConversations(updated);
    localStorage.setItem('sequential_conversations', JSON.stringify(updated));
  };

  const handleTitleEdit = (id: number, newTitle: string) => {
    const updated = conversations.map(conv => 
      conv.id === id ? { ...conv, title: newTitle } : conv
    );
    setConversations(updated);
    localStorage.setItem('sequential_conversations', JSON.stringify(updated));
    setEditingTitle(null);
  };

  const handleExport = (conversation: RecordedConversation) => {
    const content = conversation.messages.map(msg => 
      `${msg.role.toUpperCase()} ${msg.assistantName ? `(${msg.assistantName})` : ''} [${new Date(msg.timestamp).toLocaleString()}]:\n${msg.content}\n`
    ).join('\n---\n\n');

    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${conversation.title}-${new Date(conversation.date).toISOString()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const playConversation = async (conversation: RecordedConversation) => {
    if (isMuted || playingConversation !== null) return;

    setPlayingConversation(conversation.id);
    
    for (const message of conversation.messages) {
      if (playingConversation !== conversation.id) break;
      
      await new Promise<void>((resolve) => {
        audioManager.speakText(message.content, () => {
          resolve();
        });
      });
      
      // Small pause between messages
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    setPlayingConversation(null);
  };

  const stopPlaying = () => {
    audioManager.stopSpeaking();
    setPlayingConversation(null);
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={<Text size="xl" fw={700}>Recorded Conversations</Text>}
      size="xl"
    >
      <Stack gap="md">
        {conversations.length === 0 ? (
          <Text c="dimmed" ta="center" py="xl">
            No recorded conversations yet
          </Text>
        ) : (
          conversations.map(conversation => (
            <Paper
              key={conversation.id}
              p="md"
              withBorder
              style={{ backgroundColor: 'var(--mantine-color-dark-6)' }}
            >
              <Group justify="space-between" mb="xs">
                {editingTitle?.id === conversation.id ? (
                  <TextInput
                    value={editingTitle.title}
                    onChange={(e) => setEditingTitle({ ...editingTitle, title: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleTitleEdit(conversation.id, editingTitle.title);
                      }
                    }}
                    onBlur={() => handleTitleEdit(conversation.id, editingTitle.title)}
                    autoFocus
                  />
                ) : (
                  <Text size="lg" fw={500}>{conversation.title}</Text>
                )}
                <Group gap="xs">
                  <ActionIcon
                    variant="light"
                    color={playingConversation === conversation.id ? "red" : "blue"}
                    onClick={() => {
                      if (playingConversation === conversation.id) {
                        stopPlaying();
                      } else {
                        playConversation(conversation);
                      }
                    }}
                    disabled={isMuted}
                  >
                    {playingConversation === conversation.id ? (
                      <IconVolumeOff size={16} />
                    ) : (
                      <IconVolume size={16} />
                    )}
                  </ActionIcon>
                  <Menu position="bottom-end" withinPortal>
                    <Menu.Target>
                      <ActionIcon variant="subtle">
                        <IconDots size={16} />
                      </ActionIcon>
                    </Menu.Target>
                    <Menu.Dropdown>
                      <Menu.Item
                        leftSection={<IconPencil size={16} />}
                        onClick={() => setEditingTitle({ id: conversation.id, title: conversation.title })}
                      >
                        Rename
                      </Menu.Item>
                      <Menu.Item
                        leftSection={<IconDownload size={16} />}
                        onClick={() => handleExport(conversation)}
                      >
                        Export
                      </Menu.Item>
                      <Menu.Item
                        leftSection={<IconTrash size={16} />}
                        color="red"
                        onClick={() => handleDelete(conversation.id)}
                      >
                        Delete
                      </Menu.Item>
                    </Menu.Dropdown>
                  </Menu>
                </Group>
              </Group>
              <Text size="sm" c="dimmed" mb="md">
                Recorded on {new Date(conversation.date).toLocaleString()}
              </Text>
              <Stack gap="xs">
                {conversation.messages.map((message, index) => (
                  <Paper
                    key={index}
                    p="sm"
                    style={{
                      backgroundColor: message.role === 'user' ? 'var(--mantine-color-dark-7)' : 'var(--mantine-color-dark-5)',
                      borderRadius: '4px'
                    }}
                  >
                    <Group justify="space-between" mb={2}>
                      <Text size="sm" fw={500}>
                        {message.role === 'user' ? 'User' : message.assistantName || 'Assistant'}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </Text>
                    </Group>
                    <Text size="sm">{message.content}</Text>
                  </Paper>
                ))}
              </Stack>
            </Paper>
          ))
        )}
      </Stack>
    </Modal>
  );
};

export default RecordedConversations; 