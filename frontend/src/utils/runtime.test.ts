import { afterEach, describe, expect, it } from 'vitest';

describe('isTauriRuntime', () => {
  afterEach(() => {
    delete (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
    delete (window as Window & { __TAURI__?: unknown }).__TAURI__;
  });

  it('returns false for a normal Mac browser without Tauri globals', async () => {
    Object.defineProperty(window.navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    });

    const { isTauriRuntime } = await import('./runtime');

    expect(isTauriRuntime()).toBe(false);
  });

  it('returns true when __TAURI_INTERNALS__ exists', async () => {
    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      configurable: true,
      value: {},
    });

    const { isTauriRuntime } = await import('./runtime');

    expect(isTauriRuntime()).toBe(true);
  });
});
