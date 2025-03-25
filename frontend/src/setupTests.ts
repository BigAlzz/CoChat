import '@testing-library/jest-dom';
import { configure } from '@testing-library/react';
import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers';

declare global {
  namespace jest {
    interface Matchers<R = any> extends TestingLibraryMatchers<R, any> {}
  }
}

// Configure testing library
configure({
  testIdAttribute: 'data-testid',
});

class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

global.ResizeObserver = ResizeObserver;

// Mock fetch globally
const mockFetch = jest.fn();
mockFetch.mockImplementation(() => Promise.resolve({
  ok: true,
  json: () => Promise.resolve([])
} as Response));

(global as any).fetch = mockFetch; 