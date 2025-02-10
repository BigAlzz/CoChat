import { useState, useEffect } from 'react';
import { Select, Button, Group, Text, Tooltip, Badge, Alert } from '@mantine/core';
import { IconRefresh, IconAlertCircle } from '@tabler/icons-react';
import * as api from '../services/api';

interface Model {
  id: string;
  name: string;
  object?: string;
  owned_by?: string;
}

interface ModelSelectorProps {
  onModelSelect: (modelId: string) => void;
  selectedModel?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
}

const ModelSelector = ({ onModelSelect, selectedModel, disabled, style }: ModelSelectorProps) => {
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatModelName = (modelId: string): string => {
    return modelId
      .split('-')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')
      .replace(/(\d+b)/i, (match) => match.toUpperCase());
  };

  const getModelSize = (modelId: string): string => {
    const sizeMatch = modelId.match(/(\d+)b/i);
    return sizeMatch ? `${sizeMatch[1]}B` : '';
  };

  const fetchModels = async () => {
    setLoading(true);
    setError(null);
    try {
      const modelList = await api.getAvailableModels();
      if (modelList && modelList.length > 0) {
        const formattedModels = modelList.map((model) => ({
          id: model.id,
          name: model.name || model.id,
          object: model.object,
          owned_by: model.owned_by
        }));
        setModels(formattedModels);
        setError(null);
      } else {
        setError('No models available. Please check if LM Studio is running and configured correctly.');
        setModels([]);
      }
    } catch (error) {
      console.error('Error fetching models:', error);
      let errorMessage = 'Failed to connect to LM Studio. Please ensure:';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      setError(errorMessage);
      setModels([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchModels();
    const interval = setInterval(fetchModels, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="model-selector" style={style}>
      <Group gap="xs" align="flex-start">
        <div style={{ flex: 1 }}>
          <Select
            label={
              <Group gap="xs">
                <Text>Model</Text>
                {selectedModel && (
                  <Tooltip label="Model size">
                    <Badge size="sm" variant="light" color="green">
                      {getModelSize(selectedModel)}
                    </Badge>
                  </Tooltip>
                )}
              </Group>
            }
            placeholder="Select a model"
            data={models.length > 0 ? [
              {
                group: 'Local Models',
                items: models
                  .filter(model => model.owned_by === 'organization_owner')
                  .map(model => ({
                    value: model.id,
                    label: model.name
                  }))
              },
              {
                group: 'Remote Models',
                items: models
                  .filter(model => model.owned_by !== 'organization_owner')
                  .map(model => ({
                    value: model.id,
                    label: model.name
                  }))
              }
            ].filter(group => group.items.length > 0) : []}
            value={selectedModel || null}
            onChange={(value) => value && onModelSelect(value)}
            disabled={disabled || loading}
            searchable
            clearable
            maxDropdownHeight={200}
          />
          {error && (
            <Alert 
              icon={<IconAlertCircle size={16} />} 
              color="red" 
              title={
                <Group gap="xs" align="center">
                  <div
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: '#ff3333',
                      boxShadow: '0 0 5px #ff3333'
                    }}
                  />
                  <Text>Connection Error</Text>
                </Group>
              }
              mt="xs"
              styles={{
                root: {
                  backgroundColor: 'rgba(255, 51, 51, 0.1)',
                  borderColor: 'rgba(255, 51, 51, 0.2)'
                }
              }}
            >
              <Text size="sm">
                {error}
                {error.includes('Please ensure:') && (
                  <ul style={{ 
                    marginTop: '0.5rem', 
                    marginBottom: 0, 
                    paddingLeft: '1rem',
                    color: 'rgba(255, 255, 255, 0.8)'
                  }}>
                    <li>LM Studio is running on your machine</li>
                    <li>The backend server is running (cd app && python -m uvicorn main:app --reload)</li>
                    <li>The API server is accessible at http://192.168.50.89:1234</li>
                    <li>You have at least one model loaded in LM Studio</li>
                  </ul>
                )}
              </Text>
            </Alert>
          )}
        </div>
        <Tooltip label="Refresh models">
          <Button
            variant="light"
            onClick={fetchModels}
            loading={loading}
            disabled={disabled}
            style={{ marginTop: 25 }}
          >
            <IconRefresh size={16} />
          </Button>
        </Tooltip>
      </Group>
      {selectedModel && models.length > 0 && (
        <Group gap="xs" mt="xs">
          <div
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: models.find(m => m.id === selectedModel)?.owned_by === 'organization_owner' 
                ? '#39ff14'  // Green for local models
                : '#ffd700',  // Gold for remote models
              boxShadow: `0 0 5px ${models.find(m => m.id === selectedModel)?.owned_by === 'organization_owner' 
                ? '#39ff14'  // Green glow for local
                : '#ffd700'}` // Gold glow for remote
            }}
          />
          <Text size="sm" c="dimmed">
            {models.find(m => m.id === selectedModel)?.owned_by === 'organization_owner' ? 'Local Model' : 'Remote Model'}
          </Text>
        </Group>
      )}
    </div>
  );
};

export default ModelSelector; 