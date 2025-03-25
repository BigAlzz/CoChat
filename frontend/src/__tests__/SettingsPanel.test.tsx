import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { SettingsPanel } from '../components/SettingsPanel';
import { MantineProvider } from '@mantine/core';
import { useAudioStore } from '../utils/audio';
import AudioManager from '../utils/AudioManager';
import '@testing-library/jest-dom';

// Mock fetch for voice API calls
const mockResponse = {
  ok: true,
  json: () => Promise.resolve([
    { id: 'voice1', name: 'Voice 1', description: 'Test Voice 1' },
    { id: 'voice2', name: 'Voice 2', description: 'Test Voice 2' }
  ])
};

beforeEach(() => {
  // Reset all mocks
  jest.resetAllMocks();
  // Setup fetch mock
  const mockFetch = jest.fn();
  mockFetch.mockImplementation(() => Promise.resolve(mockResponse as Response));
  (global as any).fetch = mockFetch;
});

// Mock AudioManager
jest.mock('../utils/AudioManager', () => ({
  getInstance: jest.fn(() => ({
    playSound: jest.fn(),
    setVoice: jest.fn(),
    setRate: jest.fn(),
    setPitch: jest.fn(),
    setVolume: jest.fn()
  }))
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: { [key: string]: string } = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    }
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('SettingsPanel', () => {
  const renderWithProvider = (ui: React.ReactElement) => {
    return render(
      <MantineProvider defaultColorScheme="dark">
        {ui}
      </MantineProvider>
    );
  };

  it('renders settings panel with all sections', async () => {
    renderWithProvider(<SettingsPanel />);

    // Check if all sections are rendered
    await waitFor(() => {
      expect(screen.getByText('Settings')).toBeDefined();
      expect(screen.getByText('Audio Settings')).toBeDefined();
      expect(screen.getByText('Enable Sounds')).toBeDefined();
      expect(screen.getByText('Completion Sound')).toBeDefined();
    });
  });

  it('toggles mute state correctly', async () => {
    renderWithProvider(<SettingsPanel />);

    // Get the mute switch
    const muteSwitch = screen.getByRole('switch', { name: /Enable Sounds/i });

    // Initially should be unmuted
    expect(muteSwitch.getAttribute('aria-checked')).toBe('false');

    // Click to mute
    await act(async () => {
      fireEvent.click(muteSwitch);
    });

    // Should be muted
    expect(muteSwitch.getAttribute('aria-checked')).toBe('true');
  });

  it('loads and displays voice models', async () => {
    renderWithProvider(<SettingsPanel />);

    await waitFor(() => {
      expect(screen.getByText(/Voice 1/)).toBeDefined();
      expect(screen.getByText(/Voice 2/)).toBeDefined();
    });
  });
}); 