import React, { useState, useEffect } from 'react';
import { Drawer, Stack, Text, Switch, rem, Button, FileInput, Group, Box, Title, Divider } from '@mantine/core';
import VoiceSettings from './VoiceSettings';
import { useAudioStore } from '../utils/audio';
import AudioManager from '../utils/AudioManager';

interface SettingsPanelProps {
  opened: boolean;
  onClose: () => void;
  models: { id: string; name: string }[];
}

export function SettingsPanel({ opened, onClose, models }: SettingsPanelProps) {
  const { isMuted, toggleMute } = useAudioStore();
  const [completionSound, setCompletionSound] = useState<File | null>(null);
  const [isTestingSound, setIsTestingSound] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState<string>('');
  const audioManager = AudioManager.getInstance();

  // Load saved completion sound on mount
  useEffect(() => {
    const savedSoundUrl = localStorage.getItem('completionSoundUrl');
    if (savedSoundUrl) {
      fetch(savedSoundUrl)
        .then(response => response.blob())
        .then(blob => {
          const fileName = savedSoundUrl.split('/').pop() || 'completion-sound';
          const file = new File([blob], fileName, { type: blob.type });
          setCompletionSound(file);
        })
        .catch(console.error);
    }
  }, []);

  const handleSoundFileChange = async (file: File | null) => {
    if (file) {
      setCompletionSound(file);
      const soundUrl = URL.createObjectURL(file);
      try {
        await audioManager.playSound(soundUrl); // Test that the sound can be loaded
        localStorage.setItem('completionSoundUrl', soundUrl);
      } catch (error) {
        console.error('Error loading sound:', error);
        setCompletionSound(null);
      }
    } else {
      setCompletionSound(null);
      localStorage.removeItem('completionSoundUrl');
    }
  };

  const handleTestSound = async () => {
    if (completionSound) {
      setIsTestingSound(true);
      try {
        const soundUrl = URL.createObjectURL(completionSound);
        await audioManager.playSound(soundUrl);
      } catch (error) {
        console.error('Error playing test sound:', error);
      } finally {
        setIsTestingSound(false);
      }
    }
  };

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      title={<Title order={3}>Settings</Title>}
      position="right"
      size="lg"
      padding="xl"
    >
      <Stack gap="xl">
        {/* Audio Settings Section */}
        <Stack gap="md">
          <Title order={4}>Audio Settings</Title>
          <Switch
            label="Enable Sounds"
            description="Play sounds for notifications and events"
            checked={!isMuted}
            onChange={toggleMute}
          />
          
          <Box>
            <Text size="sm" fw={500} mb="xs">Completion Sound</Text>
            <Group gap="sm">
              <FileInput
                placeholder="Choose sound file"
                accept="audio/*"
                value={completionSound}
                onChange={handleSoundFileChange}
                style={{ flex: 1 }}
              />
              <Button 
                onClick={handleTestSound}
                disabled={!completionSound || isTestingSound}
                variant="light"
              >
                {isTestingSound ? 'Playing...' : 'Test Sound'}
              </Button>
            </Group>
          </Box>
        </Stack>

        <Divider />

        {/* Global Voice Settings */}
        <Stack gap="md">
          <Title order={4}>Default Voice Settings</Title>
          <Text size="sm" c="dimmed">Configure the default text-to-speech voice for all conversations</Text>
          <VoiceSettings
            opened={true}
            onClose={() => {}}
            isEmbedded={true}
          />
        </Stack>

        <Divider />

        {/* Model-Specific Voice Settings */}
        <Stack gap="md">
          <Title order={4}>Model-Specific Voice Settings</Title>
          <Text size="sm" c="dimmed">Configure different voices for each model</Text>
          {models.map(model => (
            <Box key={model.id}>
              <Title order={5} mb="xs">{model.name}</Title>
              <VoiceSettings
                modelId={model.id}
                modelName={model.name}
                opened={true}
                onClose={() => {}}
                isEmbedded={true}
              />
            </Box>
          ))}
        </Stack>
      </Stack>
    </Drawer>
  );
} 