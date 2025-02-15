import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { default as AudioManagerInstance } from './AudioManager';
import axios from 'axios';

export interface VoiceSettings {
  voiceUri: string;
  rate: number;
  pitch: number;
  volume: number;
}

interface SpeakOptions {
  onEnd: () => void;
  onError: () => void;
}

interface ModelVoiceSettings {
  [modelId: string]: VoiceSettings;
}

interface AudioState {
  isMuted: boolean;
  voiceSettings: Record<string, VoiceSettings>;
  completionSoundUrl: string | null;
  toggleMute: () => void;
  speak: (text: string, options: SpeakOptions, modelId?: string) => void;
  stopSpeaking: () => void;
  startListening: (onResult: (text: string) => void, onError: (error: Error) => void) => void;
  stopListening: () => void;
  updateVoiceSettings: (modelId: string, settings: VoiceSettings) => void;
  getVoiceSettings: (modelId: string) => VoiceSettings;
  setCompletionSound: (soundUrl: string | null) => void;
  playCompletionSound: () => Promise<void>;
  cloneSettings: (fromModelId: string, toModelId: string) => void;
}

// Speech Recognition types
interface SpeechRecognitionResult {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResultList {
  [index: number]: {
    [index: number]: SpeechRecognitionResult;
  };
}

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionError {
  error: string;
}

interface SpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: SpeechRecognitionError) => void;
  onend?: () => void;
  start: () => void;
  stop: () => void;
}

declare global {
  interface Window {
    SpeechRecognition: {
      new(): SpeechRecognition;
    };
    webkitSpeechRecognition: {
      new(): SpeechRecognition;
    };
  }
}

class SpeechRecognitionManager {
  private recognition: SpeechRecognition | null = null;
  private isListening: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognitionAPI) {
        this.recognition = new SpeechRecognitionAPI();
        this.recognition.continuous = false;
        this.recognition.interimResults = false;
        this.recognition.lang = 'en-US';
      }
    }
  }

  startListening(onResult: (text: string) => void, onError: (error: Error) => void): void {
    if (!this.recognition) {
      onError(new Error('Speech recognition not supported'));
      return;
    }

    if (this.isListening) {
      this.stopListening();
    }

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      if (event.results[0] && event.results[0][0]) {
        const text = event.results[0][0].transcript;
        if (text) {
          onResult(text);
        }
      }
    };

    this.recognition.onerror = (event: SpeechRecognitionError) => {
      onError(new Error(event.error || 'Speech recognition error'));
    };

    this.recognition.onend = () => {
      this.isListening = false;
    };

    try {
      this.recognition.start();
      this.isListening = true;
    } catch (error) {
      onError(error instanceof Error ? error : new Error('Failed to start speech recognition'));
    }
  }

  stopListening(): void {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
        this.isListening = false;
      } catch (error) {
        console.error('Error stopping speech recognition:', error);
      }
    }
  }
}

// Create a singleton instance
const speechRecognition = new SpeechRecognitionManager();

const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  voiceUri: 'Microsoft Hazel Desktop',
  rate: 1.0,
  pitch: 1.0,
  volume: 1.0
};

export const useAudioStore = create<AudioState>()(
  persist(
    (set, get) => ({
      isMuted: false,
      voiceSettings: {
        default: DEFAULT_VOICE_SETTINGS
      },
      completionSoundUrl: null,
      toggleMute: () => set(state => ({ isMuted: !state.isMuted })),
      speak: async (text, options, modelId) => {
        if (get().isMuted) return;
        
        try {
          const settings = modelId 
            ? get().getVoiceSettings(modelId) 
            : get().getVoiceSettings('default');
          
          if (!settings.voiceUri) {
            console.warn('No voice settings found');
            return;
          }

          // Generate speech using our TTS service
          const audioUrl = await speakText(text, settings.voiceUri);
          
          // Create and play audio
          const audio = new Audio(audioUrl);
          audio.volume = settings.volume || 1;
          audio.playbackRate = settings.rate || 1;
          
          if (options.onEnd) {
            audio.onended = options.onEnd;
          }

          await audio.play();
        } catch (error) {
          console.error('Error in speak:', error);
          options.onError?.();
        }
      },
      stopSpeaking: () => {
        AudioManagerInstance.getInstance().stopSpeaking();
      },
      startListening: (onResult: (text: string) => void, onError: (error: Error) => void) => {
        if (get().isMuted) {
          onError(new Error('Audio is muted'));
          return;
        }

        speechRecognition.startListening(onResult, onError);
      },
      stopListening: () => {
        speechRecognition.stopListening();
      },
      updateVoiceSettings: (modelId: string, settings: VoiceSettings) => 
        set(state => ({
          voiceSettings: {
            ...state.voiceSettings,
            [modelId]: settings
          }
        })),
      getVoiceSettings: (modelId: string) => {
        const state = get();
        return state.voiceSettings[modelId] || state.voiceSettings.default || DEFAULT_VOICE_SETTINGS;
      },
      setCompletionSound: (soundUrl: string | null) => {
        if (soundUrl) {
          localStorage.setItem('completionSoundUrl', soundUrl);
        } else {
          localStorage.removeItem('completionSoundUrl');
        }
        set({ completionSoundUrl: soundUrl });
      },
      playCompletionSound: async () => {
        const state = get();
        if (!state.isMuted && state.completionSoundUrl) {
          await AudioManagerInstance.getInstance().playSound(state.completionSoundUrl);
        }
      },
      cloneSettings: (fromModelId: string, toModelId: string) =>
        set(state => ({
          voiceSettings: {
            ...state.voiceSettings,
            [toModelId]: state.voiceSettings[fromModelId] || state.voiceSettings.default
          }
        }))
    }),
    {
      name: 'audio-storage',
      partialize: (state) => ({
        voiceSettings: state.voiceSettings
      })
    }
  )
);

class AudioManager {
  private static instance: AudioManager;
  private audioContext: AudioContext | null = null;
  private currentAudio: HTMLAudioElement | null = null;
  private audioQueue: { text: string; settings: VoiceSettings; onEnd?: () => void }[] = [];
  private isProcessingQueue: boolean = false;
  private currentRate: number = 1.0;
  private currentPitch: number = 1.0;
  private currentVolume: number = 1.0;

  private constructor() {
    // Initialize audio context when needed
  }

  static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  private initAudioContext() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }

  private async processAudioQueue() {
    if (this.isProcessingQueue || this.audioQueue.length === 0) return;

    this.isProcessingQueue = true;
    while (this.audioQueue.length > 0) {
      const item = this.audioQueue[0];
      try {
        await this.generateAndPlaySpeech(item.text, item.settings, item.onEnd);
      } catch (error) {
        console.error('Error processing audio queue:', error);
      }
      this.audioQueue.shift(); // Remove the processed item
    }
    this.isProcessingQueue = false;
  }

  private async generateAndPlaySpeech(text: string, settings: VoiceSettings, onEnd?: () => void) {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/v1/tts/speak`, {
        text,
        voice: settings.voiceUri,
        rate: this.currentRate,
        pitch: this.currentPitch
      });

      if (!response.data || !response.data.audio_path) {
        throw new Error('Invalid response from TTS service');
      }

      // Create and configure audio element
      const audio = new Audio(`${API_BASE_URL}/api/v1/tts/download/${response.data.audio_path}`);
      this.currentAudio = audio;
      audio.volume = this.currentVolume;
      audio.playbackRate = this.currentRate;

      // Play the audio
      await audio.play();

      // Wait for audio to finish
      return new Promise<void>((resolve) => {
        audio.onended = () => {
          this.currentAudio = null;
          onEnd?.();
          resolve();
        };
      });
    } catch (error) {
      console.error('Error generating speech:', error);
      this.currentAudio = null;
      onEnd?.();
    }
  }

  async playSound(soundUrl: string) {
    this.initAudioContext();
    if (!this.audioContext) return;

    try {
      const response = await fetch(soundUrl);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      
      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioContext.destination);
      source.start(0);
    } catch (error) {
      console.error('Error playing sound:', error);
    }
  }

  async speakText(text: string, settings: VoiceSettings, onEnd?: () => void) {
    const audioStore = useAudioStore.getState();
    if (audioStore.isMuted) return;

    // Add to queue
    this.audioQueue.push({ text, settings, onEnd });
    
    // Start processing if not already processing
    if (!this.isProcessingQueue) {
      this.processAudioQueue();
    }
  }

  stopSpeaking() {
    // Clear the queue
    this.audioQueue = [];
    
    // Stop current audio
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
  }

  setRate(rate: number) {
    this.currentRate = rate;
    if (this.currentAudio) {
      this.currentAudio.playbackRate = rate;
    }
  }

  setPitch(pitch: number) {
    this.currentPitch = pitch;
    // Note: HTML5 Audio doesn't support pitch directly
    // The pitch will be applied when generating speech through the TTS service
  }

  setVolume(volume: number) {
    this.currentVolume = volume;
    if (this.currentAudio) {
      this.currentAudio.volume = volume;
    }
  }
}

export const audioManager = AudioManager.getInstance();

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface Voice {
  id: string;
  name: string;
  description: string;
  lang?: string;
  isDefault?: boolean;
}

export async function getVoices(): Promise<Voice[]> {
  try {
    console.log('Fetching voices from TTS service...');
    const response = await fetch('http://localhost:8000/api/v1/tts/voices');
    console.log('TTS service response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to fetch voices:', errorText);
      throw new Error(`Failed to fetch voices: ${response.status} ${errorText}`);
    }
    
    const voices = await response.json();
    console.log('Available voices:', voices);
    
    return voices.map((voice: any) => ({
      id: voice.id,
      name: voice.name,
      description: voice.description || voice.name,
      lang: voice.lang
    }));
  } catch (error) {
    console.error('Error loading voices:', error);
    throw error;
  }
}

export async function speakText(text: string, voice: string): Promise<string> {
    try {
        console.log('Generating speech for:', { text, voice });
        
        // Request speech generation
        const response = await axios.post(`${API_BASE_URL}/api/v1/tts/speak`, {
            text,
            voice
        });

        console.log('TTS response:', response.data);

        // Get the audio file path
        const audioPath = response.data.audio_path;
        
        // Return the full URL to the audio file
        return `${API_BASE_URL}/api/v1/tts/download/${audioPath}`;
    } catch (error) {
        console.error('Error generating speech:', error);
        throw error;
    }
}

export async function playAudio(audioUrl: string): Promise<void> {
    try {
        console.log('Playing audio from URL:', audioUrl);
        const audio = new Audio(audioUrl);
        await audio.play();
    } catch (error) {
        console.error('Error playing audio:', error);
        throw error;
    }
} 