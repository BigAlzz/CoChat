import React from 'react';
import { Drawer, Title, Stack, Select, Slider, Group, Text, Button, Divider } from '@mantine/core';
import { IconPlayerPlay, IconPlayerStop } from '@tabler/icons-react';
import AudioManager from '../utils/AudioManager';
import { useAudioStore } from '../utils/audio';
import type { VoiceSettings as VoiceSettingsType } from '../utils/audio';
import { notifications } from '@mantine/notifications';

interface VoiceSettingsProps {
  opened: boolean;
  onClose: () => void;
  modelId?: string;
  modelName?: string;
  isEmbedded?: boolean;
}

const VoiceSettings: React.FC<VoiceSettingsProps> = ({ 
  opened, 
  onClose, 
  modelId, 
  modelName,
  isEmbedded = false 
}) => {
  const [selectedVoice, setSelectedVoice] = React.useState<string>('');
  const [rate, setRate] = React.useState<number>(1);
  const [pitch, setPitch] = React.useState<number>(1);
  const [volume, setVolume] = React.useState<number>(1);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [voices, setVoices] = React.useState<Array<{ id: string; name: string; description: string }>>([]);
  const [loading, setLoading] = React.useState(false);
  const { isMuted, updateVoiceSettings, getVoiceSettings } = useAudioStore();
  const audioManager = AudioManager.getInstance();

  const loadVoices = React.useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:8000/api/v1/tts/voices');
      if (!response.ok) {
        throw new Error('Failed to fetch voices');
      }
      const voiceData = await response.json();
      setVoices(voiceData.map((voice: any) => ({
        id: voice.id,
        name: voice.name,
        description: voice.description || voice.name
      })));
    } catch (error) {
      console.error('Error loading voices:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to load voices. Please check if the TTS service is running.',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSavedSettings = React.useCallback(() => {
    const settings = getVoiceSettings(modelId || 'default');
    if (settings) {
      setSelectedVoice(settings.voiceUri);
      setRate(settings.rate);
      setPitch(settings.pitch);
      setVolume(settings.volume || 1);
      audioManager.setVoice(settings.voiceUri);
    }
  }, [modelId, getVoiceSettings, audioManager]);

  React.useEffect(() => {
    void loadVoices();
    loadSavedSettings();
  }, [loadVoices, loadSavedSettings]);

  const handleVoiceChange = (value: string | null) => {
    if (value) {
      setSelectedVoice(value);
      audioManager.setVoice(value);
      
      const settings: VoiceSettingsType = {
        voiceUri: value,
        rate,
        pitch,
        volume
      };
      updateVoiceSettings(modelId || 'default', settings);
    }
  };

  const handleRateChange = (value: number) => {
    setRate(value);
    const settings: VoiceSettingsType = {
      voiceUri: selectedVoice,
      rate: value,
      pitch,
      volume
    };
    updateVoiceSettings(modelId || 'default', settings);
    audioManager.setRate(value);
  };

  const handlePitchChange = (value: number) => {
    setPitch(value);
    const settings: VoiceSettingsType = {
      voiceUri: selectedVoice,
      rate,
      pitch: value,
      volume
    };
    updateVoiceSettings(modelId || 'default', settings);
    audioManager.setPitch(value);
  };

  const handleVolumeChange = (value: number) => {
    setVolume(value);
    const settings: VoiceSettingsType = {
      voiceUri: selectedVoice,
      rate,
      pitch,
      volume: value
    };
    updateVoiceSettings(modelId || 'default', settings);
    audioManager.setVolume(value);
  };

  const handleTestVoice = async () => {
    if (!selectedVoice) {
      notifications.show({
        title: 'Warning',
        message: 'Please select a voice first',
        color: 'yellow'
      });
      return;
    }

    setIsPlaying(true);
    setLoading(true);
    try {
      await audioManager.speak('Hello, this is a test of the text to speech system.');
      notifications.show({
        title: 'Success',
        message: 'Voice test completed successfully',
        color: 'green'
      });
    } catch (error) {
      console.error('Voice test failed:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to test voice. Please check if the TTS service is running.',
        color: 'red'
      });
    } finally {
      setIsPlaying(false);
      setLoading(false);
    }
  };

  const handleResetDefaults = () => {
    setRate(1);
    setPitch(1);
    setVolume(1);
    if (voices.length > 0) {
      setSelectedVoice(voices[0].id);
      audioManager.setVoice(voices[0].id);
    }
  };

  const content = (
    <Stack gap="md">
      <Select
        label="Voice"
        placeholder="Select a voice"
        data={voices.map(voice => ({
          value: voice.id,
          label: `${voice.name} - ${voice.description}`
        }))}
        value={selectedVoice}
        onChange={handleVoiceChange}
        disabled={isMuted || loading}
      />

      <Stack gap="xs">
        <Text size="sm">Rate</Text>
        <Slider
          value={rate}
          onChange={handleRateChange}
          min={0.5}
          max={2}
          step={0.1}
          label={(value) => value.toFixed(1)}
          disabled={isMuted}
        />
      </Stack>

      <Stack gap="xs">
        <Text size="sm">Pitch</Text>
        <Slider
          value={pitch}
          onChange={handlePitchChange}
          min={0.5}
          max={2}
          step={0.1}
          label={(value) => value.toFixed(1)}
          disabled={isMuted}
        />
      </Stack>

      <Stack gap="xs">
        <Text size="sm">Volume</Text>
        <Slider
          value={volume}
          onChange={handleVolumeChange}
          min={0}
          max={1}
          step={0.1}
          label={(value) => value.toFixed(1)}
          disabled={isMuted}
        />
      </Stack>

      <Group gap="xs">
        <Button
          variant="light"
          color={isPlaying ? "red" : "blue"}
          onClick={handleTestVoice}
          leftSection={isPlaying ? <IconPlayerStop size={16} /> : <IconPlayerPlay size={16} />}
          disabled={isMuted || !selectedVoice}
          loading={loading}
        >
          {isPlaying ? "Stop" : "Test Voice"}
        </Button>

        <Button
          variant="outline"
          onClick={handleResetDefaults}
          disabled={isMuted}
        >
          Reset
        </Button>
      </Group>
    </Stack>
  );

  if (isEmbedded) {
    return content;
  }

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      title={<Title order={3}>Voice Settings</Title>}
      position="right"
      size="md"
      padding="xl"
    >
      {content}
    </Drawer>
  );
};

export default VoiceSettings; 