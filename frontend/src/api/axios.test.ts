import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockInvoke } = vi.hoisted(() => ({
  mockInvoke: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: mockInvoke,
}));

describe('axios GET params in Tauri mode', () => {
  beforeEach(() => {
    vi.resetModules();
    mockInvoke.mockReset();
    mockInvoke.mockResolvedValue({ data: {}, status: 200, status_text: 'OK' });
    localStorage.clear();
    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      configurable: true,
      value: {},
    });
  });

  afterEach(() => {
    delete (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
  });

  it('includes query params when calling get with a params config', async () => {
    const { get } = await import('./axios');

    await get('/api/dashboard', { params: { days: '30', branch_id: '2' } });

    expect(mockInvoke).toHaveBeenCalledWith(
      'api_get',
      expect.objectContaining({
        url: 'http://168.144.46.137:8080/api/dashboard?days=30&branch_id=2',
      }),
    );
  });

  it('does not use Tauri invoke for a normal Mac browser without Tauri globals', async () => {
    delete (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
    Object.defineProperty(window.navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 200,
      statusText: 'OK',
      json: vi.fn().mockResolvedValue({ ok: true }),
    }));

    const { get } = await import('./axios');

    await get('/api/health');

    expect(mockInvoke).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledWith(
      'http://168.144.46.137:8080/api/health',
      expect.objectContaining({ method: 'GET' }),
    );
  });
});
