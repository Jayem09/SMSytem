import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockInvoke } = vi.hoisted(() => ({
  mockInvoke: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', async () => {
  const actual = await vi.importActual<typeof import('@tauri-apps/api/core')>('@tauri-apps/api/core');
  return {
    ...actual,
    invoke: mockInvoke,
  };
});

describe('checkServerConnection', () => {
  beforeEach(() => {
    vi.resetModules();
    mockInvoke.mockReset();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
    delete (window as Window & { __TAURI__?: unknown }).__TAURI__;
  });

  it('uses fetch only in browser mode without Tauri globals', async () => {
    const { checkServerConnection } = await import('./connectionCheck');

    const connected = await checkServerConnection();

    expect(connected).toBe(true);
    expect(mockInvoke).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledWith('http://168.144.46.137:8080/api/health', expect.objectContaining({ method: 'GET' }));
  });
});
