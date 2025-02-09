import { Paper, Text, Box } from '@mantine/core';

interface MessageProps {
  content: string;
  role: 'user' | 'assistant';
  assistantName?: string;
}

const Message = ({ content, role, assistantName }: MessageProps) => {
  return (
    <Paper 
      className={`message ${role} chat-item`}
      p="md"
      withBorder
      style={{ opacity: 1, visibility: 'visible' }}
      data-testid="chat-message"
    >
      {role === 'assistant' && assistantName && (
        <Text size="sm" fw={500} c="dimmed" mb={4}>
          {assistantName}
        </Text>
      )}
      <Box style={{ whiteSpace: 'pre-wrap' }}>
        {content}
      </Box>
    </Paper>
  );
};

export default Message; 