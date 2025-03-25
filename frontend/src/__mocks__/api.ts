export const getAvailableModels = async () => {
  return [
    {
      id: 'gpt-3.5-turbo',
      name: 'GPT-3.5 Turbo',
      object: 'model',
      owned_by: 'organization_owner'
    }
  ];
};

export const createConversation = async (title: string, isAutonomous: boolean) => {
  return {
    id: 1,
    title,
    isAutonomous
  };
};

export const addAssistant = async (_conversationId: number, assistant: any) => {
  return {
    id: 1,
    ...assistant
  };
}; 