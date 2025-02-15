import React, { useEffect, useState } from 'react';
import { Drawer, Title, Stack, Select, Slider, Group, Text, Button, ActionIcon, Divider, Badge, Notification } from '@mantine/core';
import { IconVolume, IconPlayerPlay, IconPlayerStop } from '@tabler/icons-react';
import AudioManager from '../utils/AudioManager';
import { useAudioStore, Voice } from '../utils/audio';
import type { VoiceSettings } from '../utils/audio';
import { notifications } from '@mantine/notifications';

interface VoiceSettingsProps {
  opened: boolean;
  onClose: () => void;
  modelId?: string;
  modelName?: string;
  isEmbedded?: boolean;
}

interface WindowsVoice {
  id: string;
  name: string;
  description: string;
  service: string;
  isDefault: boolean;
}

const VoiceSettings: React.FC<VoiceSettingsProps> = ({ 
  opened, 
  onClose, 
  modelId, 
  modelName,
  isEmbedded = false 
}) => {
  const [selectedVoice, setSelectedVoice] = useState<string>('');
  const [rate, setRate] = useState<number>(1);
  const [pitch, setPitch] = useState<number>(1);
  const [volume, setVolume] = useState<number>(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [voices, setVoices] = useState<Voice[]>([]);
  const { isMuted, updateVoiceSettings, getVoiceSettings } = useAudioStore();
  const [loading, setLoading] = useState(false);
  const audioManager = AudioManager.getInstance();

  useEffect(() => {
    loadVoices();
    loadSavedSettings();
  }, [modelId]);

  const loadSavedSettings = () => {
    const settings = getVoiceSettings(modelId || 'default');
    if (settings) {
      setSelectedVoice(settings.voiceUri);
      setRate(settings.rate);
      setPitch(settings.pitch);
      setVolume(settings.volume || 1);
      audioManager.setVoice(settings.voiceUri);
    }
  };

  const loadVoices = async () => {
    try {
      setLoading(true);
      console.log('Loading available voices...');
      const response = await fetch('http://localhost:8000/api/v1/tts/voices');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch voices: ${response.status}`);
      }
      
      const availableVoices = await response.json();
      console.log('Loaded voices:', availableVoices);
      
      if (!availableVoices || availableVoices.length === 0) {
        notifications.show({
          title: 'Warning',
          message: 'No voices found. Please check if the TTS service is running and properly configured.',
          color: 'yellow',
          autoClose: false
        });
        return;
      }
      
      // Filter and format voices
      const formattedVoices = availableVoices
        .map((voice: WindowsVoice) => ({
          id: voice.id,
          name: voice.name,
          description: voice.description || voice.name,
          isDefault: voice.isDefault
        }));
      
      setVoices(formattedVoices);
      
      // Set default voice if none selected
      if (!selectedVoice && formattedVoices.length > 0) {
        const defaultVoice = formattedVoices.find((v: Voice) => v.isDefault) || formattedVoices[0];
        console.log('Setting default voice:', defaultVoice.name);
        setSelectedVoice(defaultVoice.id);
        audioManager.setVoice(defaultVoice.id);
      }
    } catch (error) {
      console.error('Failed to load voices:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to load voices. Please check if the TTS service is running and accessible.',
        color: 'red',
        autoClose: false
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVoiceChange = (value: string | null) => {
    if (value) {
      console.log('Changing voice to:', value);
      setSelectedVoice(value);
      audioManager.setVoice(value);
      
      // Save settings immediately when voice changes
      const settings = {
        voiceUri: value,
        rate,
        pitch,
        volume
      };
      console.log('Saving voice settings:', settings);
      updateVoiceSettings(modelId || 'default', settings);
    }
  };

  const handleRateChange = (value: number) => {
    setRate(value);
    const settings = {
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
    const settings = {
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
    const settings = {
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
      console.log('Testing voice:', selectedVoice);
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

  const handleSaveSettings = () => {
    if (!selectedVoice) {
      notifications.show({
        title: 'Warning',
        message: 'Please select a voice first',
        color: 'yellow'
      });
      return;
    }

    const settings = {
      voiceUri: selectedVoice,
      rate,
      pitch,
      volume
    };

    console.log('Saving voice settings:', settings);
    updateVoiceSettings(modelId || 'default', settings);

    notifications.show({
      title: 'Success',
      message: 'Voice settings saved successfully',
      color: 'green'
    });
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
        disabled={isMuted}
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

      <Group gap="md" mt="xl">
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

        <Group gap="xs">
          <Button
            variant="outline"
            onClick={handleResetDefaults}
            disabled={isMuted}
          >
            Reset
          </Button>
          <Button
            onClick={handleSaveSettings}
            disabled={isMuted || !selectedVoice}
          >
            Save Settings
          </Button>
        </Group>
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