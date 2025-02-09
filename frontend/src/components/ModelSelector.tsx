import { useState, useEffect } from 'react';
import { Select, Button, Group, Text, Tooltip, Badge, Alert } from '@mantine/core';
import { IconRefresh, IconInfoCircle, IconAlertCircle } from '@tabler/icons-react';
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
          name: formatModelName(model.id),
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
                    label: model.name || formatModelName(model.id)
                  }))
              },
              {
                group: 'Remote Models',
                items: models
                  .filter(model => model.owned_by !== 'organization_owner')
                  .map(model => ({
                    value: model.id,
                    label: model.name || formatModelName(model.id)
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
              title="Connection Error" 
              mt="xs"
            >
              <Text size="sm">
                {error}
                {error.includes('Please ensure:') && (
                  <ul style={{ marginTop: '0.5rem', marginBottom: 0, paddingLeft: '1rem' }}>
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
          <Tooltip label="Model information">
            <IconInfoCircle size={16} style={{ color: '#39ff14' }} />
          </Tooltip>
          <Text size="sm" c="dimmed">
            {models.find(m => m.id === selectedModel)?.owned_by === 'organization_owner' ? 'Local Model' : 'Remote Model'}
          </Text>
        </Group>
      )}
    </div>
  );
};

export default ModelSelector; 