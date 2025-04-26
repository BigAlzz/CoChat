import { Paper, Text, Box, Loader, Group, ActionIcon, Modal, Button, Select, Stack } from '@mantine/core';
import { IconMicrophone, IconVolume, IconMaximize, IconX, IconBulb, IconMessage, IconSearch, IconBrain } from '@tabler/icons-react';
import { useState, useCallback, useEffect, useRef } from 'react';
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

// Add CSS for animations
const iconAnimationStyles = {
  spin: {
    animation: 'spin 1s linear infinite',
  },
  pulse: {
    animation: 'pulse 1s infinite',
  },
  bounce: {
    animation: 'bounce 0.7s infinite',
  },
  blink: {
    animation: 'blink 1s steps(2, start) infinite',
  },
};

// Add keyframes to the page (only once)
if (typeof window !== 'undefined' && !document.getElementById('message-animations')) {
  const style = document.createElement('style');
  style.id = 'message-animations';
  style.innerHTML = `
    @keyframes spin { 100% { transform: rotate(360deg); } }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
    @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
    @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
    .typing-dots span { display: inline-block; width: 6px; height: 6px; margin: 0 1px; border-radius: 50%; background: #fff; opacity: 0.7; animation: blink 1.2s infinite; }
    .typing-dots span:nth-child(2) { animation-delay: 0.2s; }
    .typing-dots span:nth-child(3) { animation-delay: 0.4s; }
  `;
  document.head.appendChild(style);
}

export default function Message({ content, role, isThinking = false, assistantName, onSpeechInput, onDelete }: MessageProps) {
  const [isListening, setIsListening] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState<string>('');
  const [voices, setVoices] = useState<any[]>([]);
  const { startListening, stopListening, isMuted } = useAudioStore();
  const [displayedSections, setDisplayedSections] = useState<string[]>([]);
  const sectionIntervals = useRef<Array<NodeJS.Timeout | null>>([]);
  const prevSectionsRef = useRef<string[]>([]);

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

  // Helper to extract all supported tags in order
  function parseSectionsAll(text: string) {
    const tagDefs = [
      { tag: 'think', label: 'Thinking', icon: <IconBrain size={16} color="#a0a0a0" />, style: { color: '#a0a0a0', fontStyle: 'italic' } },
      { tag: 'analysis', label: 'Analysis', icon: <IconSearch size={16} color="#228be6" />, style: { color: '#228be6', fontStyle: 'italic' } },
      { tag: 'insights', label: 'Insights', icon: <IconBulb size={16} color="#40c057" />, style: { color: '#40c057', fontStyle: 'italic' } },
      { tag: 'response', label: 'Response', icon: <IconMessage size={16} color="#fff" />, style: { color: '#fff' } },
    ];
    const sections = [];
    let remaining = text;
    while (true) {
      let found = false;
      for (const def of tagDefs) {
        const regex = new RegExp(`<${def.tag}>([\s\S]*?)<\/${def.tag}>`, 'i');
        const match = remaining.match(regex);
        if (match) {
          const before = remaining.slice(0, match.index);
          if (before.trim()) {
            // Add any text before the tag as a generic section
            sections.push({ tag: 'other', content: before.trim(), icon: null, style: { color: '#bbb' } });
          }
          sections.push({ tag: def.tag, content: match[1].trim(), icon: def.icon, style: def.style });
          remaining = remaining.slice(match.index + match[0].length);
          found = true;
          break;
        }
      }
      if (!found) {
        if (remaining.trim()) {
          sections.push({ tag: 'other', content: remaining.trim(), icon: null, style: { color: '#bbb' } });
        }
        break;
      }
    }
    return sections;
  }

  useEffect(() => {
    const sections = parseSectionsAll(content);
    if (isThinking) {
      // Animate each section sequentially
      setDisplayedSections(Array(sections.length).fill(''));
      prevSectionsRef.current = sections.map(s => s.content);
      // Clear any previous intervals
      sectionIntervals.current.forEach(intv => intv && clearInterval(intv));
      sectionIntervals.current = [];
      let sectionIdx = 0;
      let charIdx = 0;
      function animateSection() {
        if (sectionIdx >= sections.length) return;
        sectionIntervals.current[sectionIdx] = setInterval(() => {
          setDisplayedSections(prev => {
            const updated = [...prev];
            if (charIdx < sections[sectionIdx].content.length) {
              updated[sectionIdx] = sections[sectionIdx].content.slice(0, charIdx + 1);
              charIdx++;
            } else {
              updated[sectionIdx] = sections[sectionIdx].content;
              clearInterval(sectionIntervals.current[sectionIdx]!);
              sectionIdx++;
              charIdx = 0;
              animateSection();
            }
            return updated;
          });
        }, 15);
      }
      animateSection();
      return () => {
        sectionIntervals.current.forEach(intv => intv && clearInterval(intv));
      };
    } else {
      // Not thinking: show all sections fully
      setDisplayedSections(sections.map(s => s.content));
      sectionIntervals.current.forEach(intv => intv && clearInterval(intv));
    }
  }, [content, isThinking]);

  // Helper to get animated icon for a tag
  function getAnimatedIcon(tag: string, isActive: boolean) {
    const debugStyle = { background: 'yellow', border: '1px solid red', borderRadius: 4, padding: 2, marginRight: 4 };
    switch (tag) {
      case 'think':
        return <span style={debugStyle}><IconBrain size={16} color="#a0a0a0" style={isActive ? iconAnimationStyles.spin : {}} /></span>;
      case 'analysis':
        return <span style={debugStyle}><IconSearch size={16} color="#228be6" style={isActive ? iconAnimationStyles.pulse : {}} /></span>;
      case 'insights':
        return <span style={debugStyle}><IconBulb size={16} color="#40c057" style={isActive ? iconAnimationStyles.bounce : {}} /></span>;
      case 'response':
        if (isActive) {
          // Typing indicator for response
          return (
            <span style={{ ...debugStyle, display: 'flex', alignItems: 'center', minWidth: 24 }}>
              <IconMessage size={16} color="#fff" style={{ marginRight: 2 }} />
              <span className="typing-dots">
                <span></span><span></span><span></span>
              </span>
            </span>
          );
        } else {
          return <span style={debugStyle}><IconMessage size={16} color="#fff" /></span>;
        }
      default:
        return null;
    }
  }

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
          <Box style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {parseSectionsAll(content).map((section, idx) => {
              const isActive = displayedSections[idx].length < section.content.length && (displayedSections[idx].length > 0 || idx === 0 || displayedSections[idx - 1] === section.content);
              return (
                <Box key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {getAnimatedIcon(section.tag, isActive)}
                  <Text size="sm" style={{ fontFamily: 'monospace', letterSpacing: '0.02em', ...section.style }}>{displayedSections[idx]}</Text>
                </Box>
              );
            })}
          </Box>
        ) : (
          <Box style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {parseSectionsAll(content).map((section, idx) => (
              <Box key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {getAnimatedIcon(section.tag, false)}
                <Text size="sm" style={{ fontFamily: 'monospace', letterSpacing: '0.02em', ...section.style }}>{section.content}</Text>
              </Box>
            ))}
          </Box>
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