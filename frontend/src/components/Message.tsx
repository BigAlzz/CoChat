import { Paper, Text, Box } from '@mantine/core';

interface MessageProps {
  content: string;
  role: 'user' | 'assistant';
  assistantName?: string;
}

const Message = ({ content, role, assistantName }: MessageProps) => {
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    e.dataTransfer.setData('text/plain', content);
    e.dataTransfer.effectAllowed = 'copy';
    
    // Create a ghost image that shows it's draggable
    const ghost = document.createElement('div');
    ghost.classList.add('message-ghost');
    ghost.style.position = 'absolute';
    ghost.style.top = '-1000px';
    ghost.style.backgroundColor = '#39ff14';
    ghost.style.padding = '8px';
    ghost.style.borderRadius = '4px';
    ghost.style.maxWidth = '200px';
    ghost.style.overflow = 'hidden';
    ghost.style.textOverflow = 'ellipsis';
    ghost.style.whiteSpace = 'nowrap';
    ghost.style.color = 'black';
    ghost.textContent = 'Drop to send message';
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 0, 0);
    
    setTimeout(() => {
      document.body.removeChild(ghost);
    }, 0);
  };

  return (
    <Paper 
      className={`message ${role} chat-item`}
      p="md"
      withBorder
      style={{ 
        opacity: 1, 
        visibility: 'visible',
        cursor: 'grab'
      }}
      data-testid="chat-message"
      draggable
      onDragStart={handleDragStart}
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