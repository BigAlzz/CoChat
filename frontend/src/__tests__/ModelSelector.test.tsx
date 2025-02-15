/// <reference types="@testing-library/jest-dom" />
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, jest } from '@jest/globals';
import ModelSelector from '../components/ModelSelector';
import { MantineProvider } from '@mantine/core';
import * as api from '../services/api';

// Mock the API module
jest.mock('../services/api');

describe('ModelSelector Component Tests', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  const renderWithProvider = (ui: React.ReactElement) => {
    return render(
      <MantineProvider defaultColorScheme="dark">
        {ui}
      </MantineProvider>
    );
  };

  it('should render model selector dropdown', () => {
    renderWithProvider(
      <ModelSelector
        onModelSelect={() => {}}
        selectedModel=""
        disabled={false}
      />
    );
    
    // Check if elements are present in the document
    expect(screen.getByText('Model')).toBeTruthy();
    expect(screen.getByPlaceholderText('Select a model')).toBeTruthy();
  });

  it('should show role and posture selectors when model is selected', async () => {
    // Mock successful API response
    jest.spyOn(api, 'getAvailableModels').mockResolvedValue([
      {
        id: 'gpt-3.5-turbo',
        name: 'GPT-3.5 Turbo',
        object: 'model',
        owned_by: 'organization'
      }
    ]);

    const onModelSelect = jest.fn();
    renderWithProvider(
      <ModelSelector
        onModelSelect={onModelSelect}
        selectedModel="gpt-3.5-turbo"
        disabled={false}
      />
    );
    
    await waitFor(() => {
      expect(screen.getByText('Role')).toBeTruthy();
      expect(screen.getByText('Posture')).toBeTruthy();
    });
  });

  it('should show error message when API fails', async () => {
    // Mock API failure
    jest.spyOn(api, 'getAvailableModels').mockRejectedValue(
      new Error('Failed to connect to LM Studio')
    );

    renderWithProvider(
      <ModelSelector
        onModelSelect={() => {}}
        selectedModel=""
        disabled={false}
      />
    );
    
    await waitFor(() => {
      expect(screen.getByText(/Failed to connect to LM Studio/)).toBeTruthy();
    });
  });
}); 