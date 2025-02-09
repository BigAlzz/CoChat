import { useState } from 'react';
import { Textarea, Button, Group } from '@mantine/core';
import { IconSend } from '@tabler/icons-react';

interface MessageInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  style?: React.CSSProperties;
}

const MessageInput = ({ onSend, disabled, style }: MessageInputProps) => {
  const [message, setMessage] = useState('');

  const handleSubmit = () => {
    if (message.trim()) {
      onSend(message);
      setMessage('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <Group gap="xs" align="flex-start" style={style}>
      <Textarea
        placeholder="Type your message..."
        value={message}
        onChange={(e) => setMessage(e.currentTarget.value)}
        onKeyPress={handleKeyPress}
        disabled={disabled}
        style={{ flex: 1, minHeight: '40px', opacity: 1, visibility: 'visible' }}
        autosize
        minRows={1}
        maxRows={5}
        className="message-input"
        data-testid="message-input"
      />
      <Button
        onClick={handleSubmit}
        disabled={disabled || !message.trim()}
        variant="filled"
        color="blue"
        className="send-button"
      >
        <IconSend size={16} />
      </Button>
    </Group>
  );
};

export default MessageInput; 