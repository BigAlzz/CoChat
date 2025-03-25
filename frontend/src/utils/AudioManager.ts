import { API_URL } from '../config/config';

export default class AudioManager {
    private static instance: AudioManager;
    private voices: any[] = [];
    private currentVoice: string | null = null;
    private audioQueue: HTMLAudioElement[] = [];
    private isPlaying: boolean = false;
    private voicesLoaded: boolean = false;
    private audioContext: AudioContext | null = null;
    private currentAudio: HTMLAudioElement | null = null;
    private currentRate: number = 1.0;
    private currentPitch: number = 1.0;
    private currentVolume: number = 1.0;

    private constructor() {
        this.loadVoices();
    }

    public static getInstance(): AudioManager {
        if (!AudioManager.instance) {
            AudioManager.instance = new AudioManager();
        }
        return AudioManager.instance;
    }

    private async loadVoices() {
        if (this.voicesLoaded) return;
        
        try {
            const response = await fetch(`${API_URL}/api/v1/tts/voices`);
            if (!response.ok) {
                throw new Error('Failed to fetch voices');
            }
            this.voices = await response.json();
            
            // Find the first Windows SAPI voice or any voice if no Windows voices are available
            const defaultVoice = this.voices.find(v => v.isDefault) || this.voices[0];
            if (defaultVoice) {
                this.currentVoice = defaultVoice.id;
                console.log('Set default voice to:', defaultVoice.name);
            }
            
            this.voicesLoaded = true;
        } catch (error) {
            console.error('Error loading voices:', error);
            this.voices = [];
        }
    }

    public async getVoices() {
        if (!this.voicesLoaded) {
            await this.loadVoices();
        }
        return this.voices;
    }

    public getCurrentVoice() {
        return this.currentVoice;
    }

    public setVoice(voiceId: string) {
        console.log('Setting voice to:', voiceId);
        this.currentVoice = voiceId;
    }

    public async speak(text: string): Promise<void> {
        if (!text) return;

        try {
            if (!this.currentVoice) {
                throw new Error('No voice selected. Please select a voice in the settings.');
            }

            console.log('Speaking with voice:', this.currentVoice);
            const voice = this.voices.find(v => v.id === this.currentVoice);
            if (!voice) {
                throw new Error('Selected voice not found in available voices');
            }

            const response = await fetch(`${API_URL}/api/v1/tts/speak`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text,
                    voice: this.currentVoice,
                    service: voice.service || 'windows'
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('TTS error response:', errorText);
                throw new Error(errorText || 'Failed to generate speech');
            }

            // Get the audio data as a blob
            const audioBlob = await response.blob();
            if (audioBlob.size === 0) {
                throw new Error('No audio data received');
            }

            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);
            
            // Clean up the URL when the audio is done
            audio.onended = () => {
                URL.revokeObjectURL(audioUrl);
            };

            // Add error handling for audio playback
            audio.onerror = (e) => {
                console.error('Audio playback error:', e);
                URL.revokeObjectURL(audioUrl);
                throw new Error('Failed to play audio');
            };

            this.audioQueue.push(audio);
            await this.playNext();
        } catch (error) {
            console.error('Error in TTS:', error);
            // Re-throw the error to be handled by the UI
            throw error instanceof Error ? error : new Error('Unknown error in TTS');
        }
    }

    private async playNext() {
        if (this.isPlaying || this.audioQueue.length === 0) return;

        this.isPlaying = true;
        const audio = this.audioQueue[0];

        audio.onended = () => {
            this.audioQueue.shift();
            this.isPlaying = false;
            this.playNext();
        };

        try {
            await audio.play();
        } catch (error) {
            console.error('Error playing audio:', error);
            this.isPlaying = false;
            this.audioQueue.shift();
            this.playNext();
        }
    }

    public stopSpeaking() {
        this.audioQueue.forEach(audio => {
            audio.pause();
            audio.currentTime = 0;
        });
        this.audioQueue = [];
        this.isPlaying = false;
    }

    setRate(rate: number): void {
        this.currentRate = rate;
        if (this.currentAudio) {
            this.currentAudio.playbackRate = rate;
        }
    }

    setPitch(pitch: number): void {
        this.currentPitch = pitch;
        // Note: HTML5 Audio doesn't support pitch directly
        // The pitch will be applied when generating speech through the TTS service
    }

    setVolume(volume: number): void {
        this.currentVolume = volume;
        if (this.currentAudio) {
            this.currentAudio.volume = volume;
        }
    }

    public async playSound(soundUrl: string): Promise<void> {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        }

        try {
            const response = await fetch(soundUrl);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            
            const source = this.audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(this.audioContext.destination);
            source.start(0);

            return new Promise((resolve) => {
                source.onended = () => resolve();
            });
        } catch (error) {
            console.error('Error playing sound:', error);
            throw error;
        }
    }
} 