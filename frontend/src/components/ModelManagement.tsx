import { useState, useEffect } from 'react';
import { Table, Button, Group, Text, TextInput, ActionIcon, Modal, Alert } from '@mantine/core';
import { IconTrash, IconPlus, IconEdit, IconAlertCircle } from '@tabler/icons-react';
import * as api from '../services/api';

interface LMStudioModel {
  id: string;
  object: string;
  owned_by: string;
  name?: string;
}

interface Model {
  id: string;
  name: string;
  isLoaded?: boolean;
}

const ModelManagement = () => {
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<Model | null>(null);
  const [modelForm, setModelForm] = useState({ id: '', name: '' });

  const fetchModels = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.getAvailableModels();
      setModels(response.map((model: LMStudioModel) => ({
        id: model.id,
        name: model.name || model.id.split('/').pop() || model.id,
        isLoaded: true
      })));
    } catch (err) {
      console.error('Error fetching models:', err);
      setError('Failed to fetch models');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchModels();
    const interval = setInterval(fetchModels, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleOpenModal = (model?: Model) => {
    if (model) {
      setEditingModel(model);
      setModelForm({ id: model.id, name: model.name });
    } else {
      setEditingModel(null);
      setModelForm({ id: '', name: '' });
    }
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingModel(null);
    setModelForm({ id: '', name: '' });
  };

  const handleSaveModel = async () => {
    if (!modelForm.id || !modelForm.name) return;
    
    setLoading(true);
    try {
      if (editingModel) {
        // For editing, we need to keep the same ID but update the name
        await api.updateModel({ 
          id: editingModel.id,  // Keep the same ID
          name: modelForm.name, // Update the name
          oldId: editingModel.id
        });
      } else {
        // Add new model
        await api.addModel(modelForm);
      }
      handleCloseModal();
      await fetchModels();
    } catch (err) {
      console.error('Error saving model:', err);
      setError('Failed to save model');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveModel = async (modelId: string) => {
    setLoading(true);
    try {
      await api.removeModel(modelId);
      await fetchModels();
    } catch (err) {
      console.error('Error removing model:', err);
      setError('Failed to remove model');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Group justify="space-between" mb="md">
        <Text size="lg" fw={500}>Models</Text>
        <Button
          leftSection={<IconPlus size={16} />}
          onClick={() => handleOpenModal()}
          loading={loading}
        >
          Add Model
        </Button>
      </Group>

      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>ID</Table.Th>
            <Table.Th>Name</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th>Actions</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {models.map((model) => (
            <Table.Tr key={model.id}>
              <Table.Td>{model.id}</Table.Td>
              <Table.Td>{model.name}</Table.Td>
              <Table.Td>
                <div
                  style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    backgroundColor: model.isLoaded ? '#39ff14' : '#ff3333',
                    boxShadow: `0 0 5px ${model.isLoaded ? '#39ff14' : '#ff3333'}`
                  }}
                />
              </Table.Td>
              <Table.Td>
                <Group gap="xs">
                  <ActionIcon
                    color="blue"
                    onClick={() => handleOpenModal(model)}
                    disabled={loading}
                  >
                    <IconEdit size={16} />
                  </ActionIcon>
                  <ActionIcon
                    color="red"
                    onClick={() => handleRemoveModel(model.id)}
                    disabled={loading}
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                </Group>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

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
        </Alert>
      )}

      <Modal
        opened={modalOpen}
        onClose={handleCloseModal}
        title={editingModel ? "Edit Model" : "Add New Model"}
      >
        <TextInput
          label="Model ID"
          placeholder="Enter model ID"
          value={modelForm.id}
          onChange={(e) => setModelForm({ ...modelForm, id: e.target.value })}
          mb="md"
          disabled={!!editingModel}  // Disable ID editing for existing models
          readOnly={!!editingModel}  // Make it read-only when editing
        />
        <TextInput
          label="Display Name"
          placeholder="Enter display name for the model"
          value={modelForm.name}
          onChange={(e) => setModelForm({ ...modelForm, name: e.target.value })}
          mb="md"
        />
        <Group justify="flex-end">
          <Button variant="light" onClick={handleCloseModal}>Cancel</Button>
          <Button onClick={handleSaveModel} loading={loading}>
            {editingModel ? 'Save Changes' : 'Add Model'}
          </Button>
        </Group>
      </Modal>
    </div>
  );
};

export default ModelManagement; 