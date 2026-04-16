import { vi } from 'vitest';

type StorageMock = {
  getItem: ReturnType<typeof vi.fn>;
  setItem: ReturnType<typeof vi.fn>;
  removeItem: ReturnType<typeof vi.fn>;
  clear: ReturnType<typeof vi.fn>;
};

export function createMockLocalStorage(): StorageMock {
  let store = new Map<string, string>();

  return {
    getItem: vi.fn((key: string) => store.get(String(key)) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(String(key), String(value));
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(String(key));
    }),
    clear: vi.fn(() => {
      store = new Map<string, string>();
    }),
  };
}

export function installMockLocalStorage(mockLocalStorage: StorageMock): void {
  Object.defineProperty(globalThis, 'localStorage', {
    value: mockLocalStorage,
    configurable: true,
    writable: true,
  });
}
