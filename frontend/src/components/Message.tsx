import { Paper, Text, Box, Loader, Group, ActionIcon, Modal, Button, Select, Stack } from '@mantine/core';
import { IconMicrophone, IconVolume, IconMaximize, IconX, IconBulb, IconMessage, IconSearch, IconBrain, IconUser, IconRobot, IconInfoCircle, IconAlertTriangle, IconCheck, IconClock, IconRefresh } from '@tabler/icons-react';
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
  timestamp?: string;
  status?: 'pending' | 'sent' | 'failed' | 'thinking' | 'streaming' | 'complete' | 'error';
  senderName?: string;
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

// Add this component for animated thinking dots
function ThinkingDots() {
  return (
    <span className="thinking-dots">
      <span>.</span>
      <span>.</span>
      <span>.</span>
      <style>
        {`
          .thinking-dots span {
            animation: blink 1.2s infinite;
            opacity: 0.7;
            margin: 0 2px;
            font-size: 1.5em;
          }
          .thinking-dots span:nth-child(2) { animation-delay: 0.2s; }
          .thinking-dots span:nth-child(3) { animation-delay: 0.4s; }
          @keyframes blink {
            0%, 100% { opacity: 0.7; }
            50% { opacity: 0.2; }
          }
        `}
      </style>
    </span>
  );
}

// Helper for formatting timestamps
function formatTimestamp(ts?: string) {
  if (!ts) return '';
  const date = new Date(ts);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  return isToday
    ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Avatar/icon by role
function getAvatar(role: string) {
  switch (role) {
    case 'assistant':
      return <IconRobot size={28} color="#00B894" style={{ background: '#e6fff9', borderRadius: '50%', padding: 2 }} />;
    case 'system':
      return <IconInfoCircle size={28} color="#6366f1" style={{ background: '#eef2ff', borderRadius: '50%', padding: 2 }} />;
    case 'error':
      return <IconAlertTriangle size={28} color="#e74c3c" style={{ background: '#fff0f0', borderRadius: '50%', padding: 2 }} />;
    default:
      return <IconUser size={28} color="#6366f1" style={{ background: '#e0e7ff', borderRadius: '50%', padding: 2 }} />;
  }
}

// Status indicator
function getStatusIndicator(status?: string) {
  switch (status) {
    case 'pending':
      return <IconClock size={16} color="#f1c40f" title="Pending" />;
    case 'sent':
      return <IconCheck size={16} color="#00B894" title="Sent" />;
    case 'failed':
      return <IconAlertTriangle size={16} color="#e74c3c" title="Failed" />;
    case 'thinking':
      return <ThinkingDots />;
    case 'streaming':
      return <IconRefresh size={16} color="#6366f1" className="spin" title="Streaming" />;
    case 'complete':
      return <IconCheck size={16} color="#00B894" title="Complete" />;
    case 'error':
      return <IconAlertTriangle size={16} color="#e74c3c" title="Error" />;
    default:
      return null;
  }
}

export default function Message({ content, role, isThinking = false, assistantName, onSpeechInput, onDelete, timestamp, status, senderName }: MessageProps) {
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
      } else {
        setIsPaused(true);
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
          const before = typeof match.index === 'number' ? remaining.slice(0, match.index) : '';
          if (before.trim()) {
            // Add any text before the tag as a generic section
            sections.push({ tag: 'other', content: before.trim(), icon: null, style: { color: '#bbb' } });
          }
          sections.push({ tag: def.tag, content: match[1].trim(), icon: def.icon, style: def.style });
          remaining = typeof match.index === 'number' ? remaining.slice(match.index + match[0].length) : '';
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

  // Bubble color by role
  const bubbleStyles: Record<string, React.CSSProperties> = {
    user: {
      background: 'linear-gradient(135deg, #e0e7ff 0%, #b3ffe6 100%)',
      color: '#222',
      alignSelf: 'flex-end',
      borderTopRightRadius: 0,
    },
    assistant: {
      background: 'linear-gradient(135deg, #e6fff9 0%, #d1f7ff 100%)',
      color: '#222',
      alignSelf: 'flex-start',
      borderTopLeftRadius: 0,
    },
    system: {
      background: '#eef2ff',
      color: '#6366f1',
      alignSelf: 'center',
      borderRadius: 16,
      fontStyle: 'italic',
    },
    error: {
      background: '#fff0f0',
      color: '#e74c3c',
      alignSelf: 'center',
      borderRadius: 16,
      fontStyle: 'italic',
    },
  };
  const bubbleStyle = bubbleStyles[role] || bubbleStyles['user'];

  // Animation for new bubbles
  const bubbleAnim = {
    animation: 'fadeInUp 0.4s cubic-bezier(.23,1.01,.32,1)'
  };

  // Add keyframes for fadeInUp
  if (typeof window !== 'undefined' && !document.getElementById('bubble-animations')) {
    const style = document.createElement('style');
    style.id = 'bubble-animations';
    style.innerHTML = `
      @keyframes fadeInUp {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .spin { animation: spin 1s linear infinite; }
    `;
    document.head.appendChild(style);
  }

  return (
    <Box style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginBottom: 8, flexDirection: role === 'user' ? 'row-reverse' : 'row' }}>
      {/* Avatar */}
      <Box style={{ flexShrink: 0 }}>{getAvatar(role)}</Box>
      {/* Bubble */}
      <Box style={{ ...bubbleStyle, borderRadius: 16, padding: '12px 18px', minWidth: 60, maxWidth: 480, boxShadow: '0 2px 8px rgba(0,0,0,0.07)', ...bubbleAnim, position: 'relative' }}>
        {/* Sender name and status */}
        <Group justify="space-between" align="center" mb={4} style={{ marginBottom: 4 }}>
          <Text size="xs" c="dimmed" style={{ fontWeight: 600 }}>
            {senderName || (role === 'assistant' ? assistantName || 'Assistant' : role === 'user' ? 'You' : role.charAt(0).toUpperCase() + role.slice(1))}
          </Text>
          <Box>{getStatusIndicator(isThinking ? 'thinking' : status)}</Box>
        </Group>
        {/* Message content */}
        <Box style={{ marginBottom: 4 }}>
          {isThinking && role === 'assistant' ? (
            <ThinkingDots />
          ) : (
            parseSectionsAll(content).map((section, idx) => (
              <Box key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {getAnimatedIcon(section.tag, false)}
                <Text size="sm" style={{ fontFamily: 'monospace', letterSpacing: '0.02em', ...section.style }}>{section.content}</Text>
              </Box>
            ))
          )}
        </Box>
        {/* Timestamp */}
        <Text size="xs" c="dimmed" style={{ position: 'absolute', right: 12, bottom: 6, fontSize: 11 }}>{formatTimestamp(timestamp)}</Text>
        {/* Controls (delete, TTS, etc.) */}
        <Group gap="xs" style={{ position: 'absolute', left: 12, bottom: 6 }}>
          {!isThinking && content && (
            <ActionIcon
              variant={isReading ? "filled" : "light"}
              color={isReading ? (isPaused ? "yellow" : "blue") : "gray"}
              onClick={(e) => {
                e.stopPropagation();
                handleModalRead();
              }}
              disabled={isMuted}
              size="xs"
            >
              <IconVolume size={14} />
            </ActionIcon>
          )}
          {onDelete && (
            <ActionIcon
              variant="light"
              color="red"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              size="xs"
            >
              <IconX size={14} />
            </ActionIcon>
          )}
        </Group>
      </Box>
    </Box>
  );
} 