import { useState, useEffect } from 'react';
import { Table, Button, Group, Text, TextInput, ActionIcon, Modal, Badge } from '@mantine/core';
import { IconTrash, IconPlus } from '@tabler/icons-react';
import * as api from '../services/api';

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
  const [newModel, setNewModel] = useState({ id: '', name: '' });

  const fetchModels = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.getAvailableModels();
      setModels(response.map((model: { id?: string; name: string; isLoaded?: boolean }) => ({
        id: model.id || model.name,
        name: model.name,
        isLoaded: model.isLoaded || false
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
    const interval = setInterval(fetchModels, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleAddModel = async () => {
    if (!newModel.id || !newModel.name) return;
    
    setLoading(true);
    try {
      await api.addModel(newModel);
      setModalOpen(false);
      setNewModel({ id: '', name: '' });
      await fetchModels();
    } catch (err) {
      console.error('Error adding model:', err);
      setError('Failed to add model');
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
          onClick={() => setModalOpen(true)}
          loading={loading}
        >
          Add Model
        </Button>
      </Group>

      {error && (
        <Text c="red" mb="md">
          {error}
        </Text>
      )}

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
                <Badge 
                  color={model.isLoaded ? 'green' : 'gray'}
                  variant="light"
                >
                  {model.isLoaded ? 'Loaded' : 'Not Loaded'}
                </Badge>
              </Table.Td>
              <Table.Td>
                <ActionIcon
                  color="red"
                  onClick={() => handleRemoveModel(model.id)}
                  disabled={loading}
                >
                  <IconTrash size={16} />
                </ActionIcon>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add New Model"
      >
        <TextInput
          label="Model ID"
          placeholder="Enter model ID"
          value={newModel.id}
          onChange={(e) => setNewModel({ ...newModel, id: e.target.value })}
          mb="md"
        />
        <TextInput
          label="Model Name"
          placeholder="Enter model name"
          value={newModel.name}
          onChange={(e) => setNewModel({ ...newModel, name: e.target.value })}
          mb="md"
        />
        <Group justify="flex-end">
          <Button variant="light" onClick={() => setModalOpen(false)}>Cancel</Button>
          <Button onClick={handleAddModel} loading={loading}>Add</Button>
        </Group>
      </Modal>
    </div>
  );
};

export default ModelManagement; 