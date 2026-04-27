import { isTauri } from '@tauri-apps/api/core';

export function isTauriRuntime(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    if (isTauri()) {
      return true;
    }
  } catch {
    // Fall through to explicit global checks.
  }

  return '__TAURI_INTERNALS__' in window || typeof (window as Window & { __TAURI__?: unknown }).__TAURI__ !== 'undefined';
}
