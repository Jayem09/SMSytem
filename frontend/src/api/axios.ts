import { fetch as tauriFetch } from '@tauri-apps/plugin-http';

declare global {
  interface Window {
    __TAURI__?: unknown;
    __TAURI_INTERNALS__?: unknown;
  }
}

const getFetch = () => {
  const isTauriEnv = typeof window !== 'undefined' && (window as any).__TAURI__ != null;
  // Use Tauri fetch only when running inside a real TAURI environment
  if (isTauriEnv && typeof tauriFetch === 'function') {
    return tauriFetch;
  }
  // Fall back to native fetch in browser/dev environments
  const gf = (typeof globalThis !== 'undefined' ? (globalThis as any).fetch : undefined);
  if (typeof gf === 'function') {
    return gf;
  }
  throw new Error('No fetch available');
};

export const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

const fetchFn = getFetch();
console.log('API Base URL:', baseURL);
console.log('Fetch function:', typeof fetchFn);

interface ApiResponse {
  data: unknown;
  status: number;
  statusText: string;
  headers: Record<string, string>;
}

type ApiConfig = {
  timeout?: number;
  signal?: AbortSignal;
  headers?: Record<string, string>;
  params?: Record<string, string>;
};

class TauriApi {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  private getFullUrl(url: string, config?: ApiConfig): string {
    if (config && config.params) {
      const params = new URLSearchParams(config.params).toString();
      url += `?${params}`;
    }
    return url.startsWith('http') ? url : this.baseURL + url;
  }

  private async request(
    method: string,
    url: string,
    data?: unknown,
    config?: ApiConfig
  ): Promise<ApiResponse> {
    const fullUrl = this.getFullUrl(url, config);
    const token = localStorage.getItem('token');

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (config?.headers) {
      Object.assign(headers, config.headers);
    }

    console.log(`HTTP ${method} to:`, fullUrl);

    const response = await fetchFn(fullUrl, {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
      connectTimeout: config?.timeout || 30000,
    });

    console.log('Response status:', response.status);

    let responseData: unknown;
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      responseData = await response.json();
    } else {
      responseData = await response.text();
    }

    return {
      data: responseData,
      status: response.status,
      statusText: response.statusText,
      headers: {},
    };
  }

  get(url: string, config?: ApiConfig): Promise<ApiResponse> {
    return this.request('GET', url, undefined, config);
  }

  post(url: string, data?: unknown, config?: ApiConfig): Promise<ApiResponse> {
    return this.request('POST', url, data, config);
  }

  put(url: string, data?: unknown, config?: ApiConfig): Promise<ApiResponse> {
    return this.request('PUT', url, data, config);
  }

  delete(url: string, config?: ApiConfig): Promise<ApiResponse> {
    return this.request('DELETE', url, undefined, config);
  }

  patch(url: string, data?: unknown, config?: ApiConfig): Promise<ApiResponse> {
    return this.request('PATCH', url, data, config);
  }
}

const api = new TauriApi(baseURL);

const handle401 = () => {
  const isAuthPage = window.location.pathname === '/login' || window.location.pathname === '/register';
  if (!isAuthPage) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  }
};

const wrapMethod = (originalFn: Function): ((
  url: string,
  dataOrConfig?: unknown,
  config?: ApiConfig
) => Promise<ApiResponse>) => {
  return async (
    url: string,
    dataOrConfig?: unknown,
    config?: ApiConfig
  ): Promise<ApiResponse> => {
    try {
      if (dataOrConfig && typeof dataOrConfig === 'object' && !Array.isArray(dataOrConfig)) {
        const hasSignal = 'signal' in (dataOrConfig as ApiConfig);
        const hasParams = 'params' in (dataOrConfig as ApiConfig);
        if (hasSignal || hasParams) {
          return await originalFn(url, undefined, dataOrConfig as ApiConfig) as Promise<ApiResponse>;
        }
      }
      return await originalFn(url, dataOrConfig, config) as Promise<ApiResponse>;
    } catch (error) {
      const err = error as { status?: number };
      if (err.status === 401) {
        handle401();
      }
      throw error;
    }
  };
};

api.get = wrapMethod(api.get.bind(api));
api.post = wrapMethod(api.post.bind(api));
api.put = wrapMethod(api.put.bind(api));
api.delete = wrapMethod(api.delete.bind(api));
api.patch = wrapMethod(api.patch.bind(api));

export const checkHealthNative = async (): Promise<boolean> => {
  const healthUrl = `${baseURL}/api/health`;
  console.log('=== HEALTH CHECK START ===');
  console.log('URL:', healthUrl);

  // Simple delay helper
  const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  // Retry strategy: try methods in order, with backoff between attempts
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // Step 1: Try Tauri HTTP plugin
    try {
      console.log('Attempt', attempt, "- Trying Tauri HTTP plugin...");
      const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http');
      const response = await tauriFetch(healthUrl, {
        method: 'GET',
      });
      console.log('Tauri HTTP status:', response.status, 'ok:', response.ok);
      if (response.ok || response.status === 200) {
        return true;
      }
    } catch (err) {
      console.error('Tauri HTTP error:', err);
    }

    // Step 2: Try native fetch
    try {
      console.log('Attempt', attempt, '- Trying native fetch...');
      const response = await fetch(healthUrl);
      console.log('Native fetch status:', response.status, 'ok:', response.ok);
      if (response.ok || response.status === 200) {
        return true;
      }
    } catch (err) {
      console.error('Native fetch error:', err);
    }

    // Step 3: Try shell curl
    try {
      console.log('Attempt', attempt, '- Trying shell curl...');
      const { Command } = await import('@tauri-apps/plugin-shell');
      const command = Command.create('curl', ['-s', '-o', '/dev/null', '-w', '%{http_code}', healthUrl]);
      const output = await command.execute();
      console.log('Shell curl result:', output);
      if (output.code === 0) {
        const status = parseInt(output.stdout.trim(), 10);
        console.log('Shell curl status:', status);
        if (status >= 200 && status < 400) {
          return true;
        }
      }
    } catch (err) {
      console.error('Shell curl error:', err);
    }

    // Backoff before the next attempt (avoid hammering the server)
    if (attempt < maxAttempts) {
      const backoff = 500 * attempt; // 500ms, 1000ms, 1500ms
      console.log(`Health check failed on attempt ${attempt}. Backing off ${backoff}ms...`);
      await delay(backoff);
    }
  }

  console.log('=== ALL METHODS FAILED ===');
  return false;
};

export const createAbortController = (): AbortController => {
  return new AbortController();
};

export default api;
