import { useState, useRef } from 'react';
import { Textarea, Button, Group, ActionIcon, Box, FileButton, Text } from '@mantine/core';
import { IconSend, IconMicrophone, IconUpload, IconFile, IconX } from '@tabler/icons-react';
import { useAudioStore } from '../utils/audio';
import { notifications } from '@mantine/notifications';

interface MessageInputProps {
  onSend: (message: string) => void;
  onFileUpload?: (file: File) => void;
  disabled?: boolean;
  style?: React.CSSProperties;
}

export default function MessageInput({ onSend, onFileUpload, disabled = false, style }: MessageInputProps) {
  const [message, setMessage] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { startListening, stopListening, isMuted } = useAudioStore();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      onSend(message.trim());
      setMessage('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleVoiceInput = () => {
    if (isListening) {
      stopListening();
      setIsListening(false);
      return;
    }

    setIsListening(true);
    startListening(
      (text) => {
        setMessage(prev => prev + (prev ? ' ' : '') + text);
        setIsListening(false);
      },
      (error) => {
        console.error('Speech recognition error:', error);
        setIsListening(false);
      }
    );
  };

  const handleFileSelect = (file: File) => {
    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      notifications.show({
        title: 'Error',
        message: 'File size must be less than 10MB',
        color: 'red'
      });
      return;
    }

    setSelectedFile(file);
    // Read file content
    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target?.result;
      if (typeof content === 'string') {
        setMessage(prev => prev + (prev ? '\n\n' : '') + `[File Content from ${file.name}]:\n${content}`);
      }
    };
    reader.readAsText(file);
    
    if (onFileUpload) {
      onFileUpload(file);
    }
  };

  return (
    <Box 
      component="form" 
      onSubmit={handleSubmit} 
      style={{ ...style }}
      onDragOver={(e) => {
        e.preventDefault();
        e.currentTarget.style.backgroundColor = 'rgba(57, 255, 20, 0.1)';
        e.dataTransfer.dropEffect = 'copy';
      }}
      onDragLeave={(e) => {
        e.currentTarget.style.backgroundColor = '';
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.currentTarget.style.backgroundColor = '';
        const content = e.dataTransfer.getData('text/plain');
        if (content) {
          setMessage(prev => prev + (prev ? '\n' : '') + content);
          if (textareaRef.current) {
            textareaRef.current.focus();
          }
        }
      }}
    >
      <Group gap="xs" align="flex-start">
        <Textarea
          ref={textareaRef}
          placeholder="Type your message..."
          value={message}
          onChange={(e) => setMessage(e.currentTarget.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          autosize
          minRows={1}
          maxRows={5}
          style={{ flex: 1 }}
        />
        <Group gap="xs">
          <FileButton
            onChange={(file: File | null) => {
              if (file) {
                handleFileSelect(file);
              }
            }}
            accept=".txt,.md,.json,.csv,.log"
          >
            {(props) => (
              <ActionIcon
                variant="light"
                color="blue"
                {...props}
                disabled={disabled}
                size="lg"
              >
                <IconUpload size={20} />
              </ActionIcon>
            )}
          </FileButton>
          <ActionIcon
            variant={isListening ? "filled" : "light"}
            color={isListening ? "red" : "blue"}
            onClick={handleVoiceInput}
            disabled={disabled || isMuted}
            size="lg"
          >
            <IconMicrophone size={20} />
          </ActionIcon>
          <Button type="submit" disabled={disabled || !message.trim()}>
            Send
          </Button>
        </Group>
      </Group>
      {selectedFile && (
        <Group mt="xs" gap="xs">
          <IconFile size={16} />
          <Text size="sm">{selectedFile.name}</Text>
          <ActionIcon 
            size="xs" 
            variant="subtle" 
            color="red"
            onClick={() => setSelectedFile(null)}
          >
            <IconX size={14} />
          </ActionIcon>
        </Group>
      )}
    </Box>
  );
} 