import { Paper, Text, Box, Loader, Group, ActionIcon, Modal, Button, Select, Stack } from '@mantine/core';
import { IconMicrophone, IconVolume, IconMaximize, IconX } from '@tabler/icons-react';
import { useState, useCallback, useEffect } from 'react';
import { useAudioStore } from '../utils/audio';
import AudioManager from '../utils/AudioManager';
import { notifications } from '@mantine/notifications';

interface MessageProps {
  content: string;
  role: string;
  isThinking?: boolean;
  assistantName?: string;
  onSpeechInput?: (text: string) => void;
  onDelete?: () => void;
}

export default function Message({ content, role, isThinking = false, assistantName, onSpeechInput, onDelete }: MessageProps) {
  const [isListening, setIsListening] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState<string>('');
  const [voices, setVoices] = useState<any[]>([]);
  const { startListening, stopListening, isMuted } = useAudioStore();

  useEffect(() => {
    const loadVoices = async () => {
      try {
        const audioManager = AudioManager.getInstance();
        const availableVoices = await audioManager.getVoices();
        setVoices(availableVoices.map(voice => ({
          value: voice.id,
          label: `${voice.name} - ${voice.description}`
        })));
        if (availableVoices.length > 0 && !selectedVoice) {
          setSelectedVoice(availableVoices[0].id);
        }
      } catch (error) {
        console.error('Failed to load voices:', error);
      }
    };
    loadVoices();
  }, []);

  const handleSpeechRecognition = useCallback(() => {
    if (isListening) {
      stopListening();
      setIsListening(false);
      return;
    }

    setIsListening(true);
    startListening(
      (text) => {
        setIsListening(false);
        if (onSpeechInput) {
          onSpeechInput(text);
        }
      },
      (error) => {
        console.error('Speech recognition error:', error);
        setIsListening(false);
      }
    );
  }, [isListening, startListening, stopListening, onSpeechInput]);

  const handleModalRead = async () => {
    if (isReading) {
      if (isPaused) {
        setIsPaused(false);
        try {
          await AudioManager.getInstance().resumeSpeaking();
        } catch (error) {
          console.error('Error resuming speech:', error);
          notifications.show({
            title: 'Error',
            message: error instanceof Error ? error.message : 'Failed to resume reading',
            color: 'red'
          });
        }
      } else {
        setIsPaused(true);
        AudioManager.getInstance().pauseSpeaking();
      }
      return;
    }

    setIsReading(true);
    setIsPaused(false);
    try {
      await AudioManager.getInstance().speak(content);
      notifications.show({
        title: 'Success',
        message: 'Started reading the message',
        color: 'green'
      });
    } catch (error) {
      console.error('Error reading message:', error);
      notifications.show({
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to read the message',
        color: 'red',
        autoClose: false
      });
    } finally {
      setIsReading(false);
      setIsPaused(false);
    }
  };

  useEffect(() => {
    return () => {
      // Cleanup: stop any ongoing speech when component unmounts
      if (isReading) {
        AudioManager.getInstance().stopSpeaking();
        setIsReading(false);
        setIsPaused(false);
      }
      if (isListening) {
        stopListening();
      }
    };
  }, [stopListening, isListening, isReading]);

  // Don't render empty messages unless thinking
  if (!content && !isThinking) return null;

  return (
    <>
      <Paper
        shadow="sm"
        p="md"
        withBorder
        style={{
          backgroundColor: role === 'assistant' ? '#1A1B1E' : '#25262B',
          marginBottom: '1rem',
          cursor: 'pointer'
        }}
        onClick={() => !isThinking && setShowModal(true)}
        draggable
        onDragStart={(e) => {
          e.stopPropagation();
          e.dataTransfer.setData('text/plain', content);
          e.dataTransfer.effectAllowed = 'copy';
          // Add visual feedback
          const element = e.currentTarget as HTMLElement;
          element.style.opacity = '0.5';
        }}
        onDragEnd={(e) => {
          // Reset visual feedback
          const element = e.currentTarget as HTMLElement;
          element.style.opacity = '1';
        }}
      >
        <Group justify="space-between" mb={4}>
          <Text size="sm" c="dimmed">
            {role === 'assistant' ? assistantName || 'Assistant' : 'You'}
          </Text>
          <Group gap="xs">
            {!isThinking && content && (
              <ActionIcon
                variant={isReading ? "filled" : "light"}
                color={isReading ? (isPaused ? "yellow" : "blue") : "gray"}
                onClick={(e) => {
                  e.stopPropagation();
                  handleModalRead();
                }}
                disabled={isMuted}
              >
                <IconVolume size={16} />
              </ActionIcon>
            )}
            <ActionIcon
              variant="light"
              onClick={(e) => {
                e.stopPropagation();
                setShowModal(true);
              }}
            >
              <IconMaximize size={16} />
            </ActionIcon>
            {onDelete && (
              <ActionIcon
                variant="light"
                color="red"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
              >
                <IconX size={16} />
              </ActionIcon>
            )}
          </Group>
        </Group>
        {isThinking ? (
          <Box style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Loader size="sm" />
            <Text size="sm">Thinking...</Text>
          </Box>
        ) : (
          <Text style={{ whiteSpace: 'pre-wrap' }}>{content}</Text>
        )}
      </Paper>

      <Modal
        opened={showModal}
        onClose={() => {
          setShowModal(false);
          if (isReading) {
            AudioManager.getInstance().stopSpeaking();
            setIsReading(false);
            setIsPaused(false);
          }
        }}
        title={role === 'assistant' ? assistantName || 'Assistant' : 'You'}
        size="xl"
      >
        <Stack gap="md">
          <Group justify="space-between">
            <Select
              label="Select Voice"
              placeholder="Choose a voice"
              data={voices}
              value={selectedVoice}
              onChange={(value) => {
                setSelectedVoice(value || '');
                if (value) {
                  AudioManager.getInstance().setVoice(value);
                }
              }}
              style={{ width: '300px' }}
            />
            <Button
              variant={isReading ? "filled" : "light"}
              color={isReading ? "red" : "blue"}
              onClick={handleModalRead}
              leftSection={<IconVolume size={16} />}
              loading={isReading}
              disabled={isMuted}
            >
              {isReading ? 'Stop Reading' : 'Read'}
            </Button>
          </Group>
          <Text style={{ whiteSpace: 'pre-wrap' }}>{content}</Text>
        </Stack>
      </Modal>
    </>
  );
} 