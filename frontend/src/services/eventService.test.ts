import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('eventService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetModules();
    localStorage.clear();
  });

  afterEach(async () => {
    vi.useRealTimers();
    delete (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
  });

  it('falls back to polling status in packaged Tauri builds', async () => {
    const eventSourceConstructor = vi.fn(() => ({
      close: vi.fn(),
      addEventListener: vi.fn(),
      onopen: null,
      onerror: null,
    }));

    globalThis.EventSource = eventSourceConstructor as unknown as typeof EventSource;
    (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {};

    const mockCheckServerConnection = vi.fn().mockResolvedValue(true);

    vi.doMock('./connectionCheck', () => ({
      checkServerConnection: mockCheckServerConnection,
    }));

    const { disconnect, onStatusChange, startEventService } = await import('./eventService');

    const statuses: string[] = [];
    const unsubscribe = onStatusChange((status) => statuses.push(status));

    startEventService();
    await vi.runOnlyPendingTimersAsync();

    expect(eventSourceConstructor).not.toHaveBeenCalled();
    expect(mockCheckServerConnection).toHaveBeenCalled();
    expect(statuses).toContain('polling');

    unsubscribe();
    disconnect();
  });
});
