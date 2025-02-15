export class AudioManager {
  private static instance: AudioManager;
  private synthesis: SpeechSynthesis;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private paused: boolean = false;
  private resumeText: string = '';
  private resumePosition: number = 0;

  private constructor() {
    this.synthesis = window.speechSynthesis;
  }

  public static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  public async speak(text: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        if (this.currentUtterance) {
          this.synthesis.cancel();
        }

        this.resumeText = text;
        this.resumePosition = 0;
        this.paused = false;

        const utterance = new SpeechSynthesisUtterance(text);
        this.currentUtterance = utterance;

        let wordPosition = 0;
        utterance.onboundary = (event) => {
          if (event.name === 'word') {
            wordPosition = event.charIndex;
          }
        };

        utterance.onend = () => {
          this.currentUtterance = null;
          this.paused = false;
          resolve();
        };

        utterance.onerror = (event) => {
          this.currentUtterance = null;
          this.paused = false;
          reject(new Error(`Speech synthesis error: ${event.error}`));
        };

        this.synthesis.speak(utterance);
      } catch (error) {
        reject(error);
      }
    });
  }

  public pauseSpeaking(): void {
    if (this.currentUtterance && this.synthesis.speaking) {
      this.paused = true;
      this.synthesis.pause();
    }
  }

  public async resumeSpeaking(): Promise<void> {
    if (this.paused && this.resumeText) {
      this.paused = false;
      this.synthesis.resume();
    }
  }

  public stopSpeaking(): void {
    this.synthesis.cancel();
    this.currentUtterance = null;
    this.paused = false;
    this.resumeText = '';
    this.resumePosition = 0;
  }

  public getVoices(): SpeechSynthesisVoice[] {
    return this.synthesis.getVoices();
  }
}

export default AudioManager; 