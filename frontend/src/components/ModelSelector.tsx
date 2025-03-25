import { useState, useEffect } from 'react';
import { Select, Button, Group, Text, Tooltip, Badge, Alert, Stack, Box } from '@mantine/core';
import { IconRefresh, IconAlertCircle } from '@tabler/icons-react';
import * as api from '../services/api';
import { ASSISTANT_ROLES, ASSISTANT_POSTURES, DEFAULT_ROLE, DEFAULT_POSTURE } from '../config/assistantConfig';

interface Model {
  id: string;
  name: string;
  object?: string;
  owned_by?: string;
}

interface ModelSelectorProps {
  onModelSelect: (modelId: string, role: string, posture: string) => void;
  selectedModel?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
}

const ModelSelector = ({ onModelSelect, selectedModel, disabled, style }: ModelSelectorProps) => {
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState(DEFAULT_ROLE);
  const [selectedPosture, setSelectedPosture] = useState(DEFAULT_POSTURE);

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

  const handleModelSelect = (value: string | null) => {
    if (value) {
      onModelSelect(value, selectedRole, selectedPosture);
    }
  };

  const handleRoleSelect = (value: string | null) => {
    if (value) {
      setSelectedRole(value);
      if (selectedModel) {
        onModelSelect(selectedModel, value, selectedPosture);
      }
    }
  };

  const handlePostureSelect = (value: string | null) => {
    if (value) {
      setSelectedPosture(value);
      if (selectedModel) {
        onModelSelect(selectedModel, selectedRole, value);
      }
    }
  };

  return (
    <Box style={style}>
      <Stack gap="md">
        <Group gap="xs" align="flex-start">
          <Select
            label={
              <Group gap="xs">
                <Text size="sm" fw={500}>Model</Text>
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
            onChange={handleModelSelect}
            disabled={disabled || loading}
            searchable
            clearable
            maxDropdownHeight={400}
            style={{ flex: 1 }}
            styles={{
              input: {
                backgroundColor: 'var(--mantine-color-dark-6)',
                borderColor: 'var(--mantine-color-dark-5)',
                color: 'var(--mantine-color-text)',
                animation: selectedModel ? 'none' : 'glowPulse 2s infinite',
                '@keyframes glowPulse': {
                  '0%': {
                    boxShadow: '0 0 5px rgba(57, 255, 20, 0)',
                    borderColor: 'var(--mantine-color-dark-5)',
                  },
                  '50%': {
                    boxShadow: '0 0 10px rgba(57, 255, 20, 0.3)',
                    borderColor: 'rgba(57, 255, 20, 0.5)',
                  },
                  '100%': {
                    boxShadow: '0 0 5px rgba(57, 255, 20, 0)',
                    borderColor: 'var(--mantine-color-dark-5)',
                  }
                }
              },
              dropdown: {
                backgroundColor: 'var(--mantine-color-dark-6)',
                borderColor: 'var(--mantine-color-dark-5)',
              },
              option: {
                color: 'var(--mantine-color-text)',
                '&[data-selected]': {
                  backgroundColor: 'var(--mantine-primary-color-filled)',
                  color: 'black',
                },
                '&[data-hovered]': {
                  backgroundColor: 'rgba(57, 255, 20, 0.1)',
                }
              }
            }}
          />
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

        {selectedModel && (
          <Group grow>
            <Select
              label={<Text size="sm" fw={500}>Role</Text>}
              placeholder="Select role"
              data={ASSISTANT_ROLES.map(role => ({
                value: role.value,
                label: role.label,
                description: role.description
              }))}
              value={selectedRole}
              onChange={handleRoleSelect}
              disabled={disabled || loading}
              styles={{
                input: {
                  backgroundColor: 'var(--mantine-color-dark-6)',
                  borderColor: 'var(--mantine-color-dark-5)',
                  color: 'var(--mantine-color-text)',
                },
                dropdown: {
                  backgroundColor: 'var(--mantine-color-dark-6)',
                  borderColor: 'var(--mantine-color-dark-5)',
                },
                option: {
                  color: 'var(--mantine-color-text)',
                  '&[data-selected]': {
                    backgroundColor: 'var(--mantine-primary-color-filled)',
                    color: 'black',
                  },
                  '&[data-hovered]': {
                    backgroundColor: 'rgba(57, 255, 20, 0.1)',
                  }
                }
              }}
            />
            <Select
              label={<Text size="sm" fw={500}>Posture</Text>}
              placeholder="Select posture"
              data={ASSISTANT_POSTURES.map(posture => ({
                value: posture.value,
                label: posture.label,
                description: posture.description
              }))}
              value={selectedPosture}
              onChange={handlePostureSelect}
              disabled={disabled || loading}
              styles={{
                input: {
                  backgroundColor: 'var(--mantine-color-dark-6)',
                  borderColor: 'var(--mantine-color-dark-5)',
                  color: 'var(--mantine-color-text)',
                },
                dropdown: {
                  backgroundColor: 'var(--mantine-color-dark-6)',
                  borderColor: 'var(--mantine-color-dark-5)',
                },
                option: {
                  color: 'var(--mantine-color-text)',
                  '&[data-selected]': {
                    backgroundColor: 'var(--mantine-primary-color-filled)',
                    color: 'black',
                  },
                  '&[data-hovered]': {
                    backgroundColor: 'rgba(57, 255, 20, 0.1)',
                  }
                }
              }}
            />
          </Group>
        )}

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
            mt="md"
            styles={{
              root: {
                backgroundColor: 'rgba(255, 51, 51, 0.1)',
                borderColor: 'rgba(255, 51, 51, 0.2)'
              }
            }}
          >
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
          </Alert>
        )}
      </Stack>
    </Box>
  );
};

export default ModelSelector; 