import { useState, useRef } from 'react';
import { Textarea, Button, Group, ActionIcon, Box, FileButton, Text } from '@mantine/core';
import { IconSend, IconMicrophone, IconUpload, IconFile, IconX } from '@tabler/icons-react';
import { useAudioStore } from '../utils/audio';
import { notifications } from '@mantine/notifications';
import Papa from 'papaparse';

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

  const handleFileSelect = async (file: File) => {
    if (file.size > 20 * 1024 * 1024) { // 20MB limit
      notifications.show({
        title: 'Error',
        message: 'File size must be less than 20MB',
        color: 'red'
      });
      return;
    }

    setSelectedFile(file);
    
    try {
      let content = '';
      const fileType = file.type || file.name.split('.').pop()?.toLowerCase();

      if (fileType === 'text/csv' || file.name.endsWith('.csv')) {
        // Handle CSV files
        content = await new Promise((resolve, reject) => {
          Papa.parse(file, {
            complete: (results) => {
              const formattedData = results.data
                .map(row => row.join(','))
                .join('\n');
              resolve(`[CSV Content from ${file.name}]:\n${formattedData}`);
            },
            error: (error) => reject(error),
          });
        });
      } else if (fileType === 'application/pdf' || file.name.endsWith('.pdf')) {
        // For PDF files, we'll need to send it to the backend for processing
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await fetch('http://localhost:8000/api/v1/files/extract-pdf', {
          method: 'POST',
          body: formData,
        });
        
        if (!response.ok) {
          throw new Error('Failed to extract PDF content');
        }
        
        const result = await response.json();
        content = `[PDF Content from ${file.name}]:\n${result.content}`;
      } else {
        // Handle text files as before
        const reader = new FileReader();
        content = await new Promise((resolve, reject) => {
          reader.onload = (e) => {
            const content = e.target?.result;
            if (typeof content === 'string') {
              resolve(`[File Content from ${file.name}]:\n${content}`);
            } else {
              reject(new Error('Failed to read file content'));
            }
          };
          reader.onerror = () => reject(reader.error);
          reader.readAsText(file);
        });
      }

      setMessage(prev => prev + (prev ? '\n\n' : '') + content);
      
      if (onFileUpload) {
        onFileUpload(file);
      }
    } catch (error) {
      console.error('Error processing file:', error);
      notifications.show({
        title: 'Error',
        message: `Failed to process file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        color: 'red'
      });
      setSelectedFile(null);
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
        if (e.dataTransfer.files.length > 0) {
          handleFileSelect(e.dataTransfer.files[0]);
        } else {
          const content = e.dataTransfer.getData('text/plain');
          if (content) {
            setMessage(prev => prev + (prev ? '\n' : '') + content);
            if (textareaRef.current) {
              textareaRef.current.focus();
            }
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
            accept=".txt,.md,.json,.csv,.log,.pdf"
          >
            {(props) => (
              <ActionIcon
                variant="light"
                color="blue"
                {...props}
                disabled={disabled}
                size="lg"
                title="Upload file (TXT, MD, JSON, CSV, LOG, PDF)"
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