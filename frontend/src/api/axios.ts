import { invoke } from '@tauri-apps/api/core';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://168.144.46.137:8080';

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

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

  private getToken(): string | null {
    return localStorage.getItem('token');
  }

  private async fetchRequest(
    method: string,
    url: string,
    data?: unknown
  ): Promise<ApiResponse> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const options: RequestInit = {
      method,
      headers,
    };

    if (data && method !== 'GET') {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);
    let responseData: unknown;
    try {
      responseData = await response.json();
    } catch {
      responseData = null;
    }

    return {
      data: responseData,
      status: response.status,
      statusText: response.statusText,
      headers: {},
    };
  }

  private async request(
    method: string,
    url: string,
    data?: unknown,
    config?: ApiConfig
  ): Promise<ApiResponse> {
    const fullUrl = this.getFullUrl(url, config);
    
    // Try Tauri invoke first, fall back to fetch
    const token = this.getToken();
    try {
      if (isTauri && typeof invoke !== 'undefined') {
        if (method === 'GET') {
          const result = await invoke<{data: unknown; status: number; status_text: string}>('api_get', { url: fullUrl, token });
          return {
            data: result.data,
            status: result.status,
            statusText: result.status_text,
            headers: {},
          };
        } else {
          const body = data ? JSON.stringify(data) : '{}';
          const result = await invoke<{data: unknown; status: number; status_text: string}>('api_post', { url: fullUrl, body, token });
          return {
            data: result.data,
            status: result.status,
            statusText: result.status_text,
            headers: {},
          };
        }
      }
    } catch (err) {
      console.warn('[API] Tauri invoke not available, using fetch:', err);
    }

    // Fallback to fetch for browser dev mode
    return this.fetchRequest(method, fullUrl, data);
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

const api = new TauriApi(API_BASE);

const wrapMethod = (originalFn: (url: string, dataOrConfig?: unknown, config?: ApiConfig) => Promise<ApiResponse>): ((
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
        const isAuthPage = window.location.pathname === '/login' || window.location.pathname === '/register';
        if (!isAuthPage) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.location.href = '/login';
        }
      }
      throw error;
    }
  };
};

const apiGet = wrapMethod(api.get.bind(api));
const apiPost = wrapMethod(api.post.bind(api));
const apiPut = wrapMethod(api.put.bind(api));
const apiDelete = wrapMethod(api.delete.bind(api));
const apiPatch = wrapMethod(api.patch.bind(api));

export { apiGet as get, apiPost as post, apiPut as put, apiDelete as delete, apiPatch as patch };
export const checkHealthNative = async () => {
  const res = await api.get('/api/health');
  return res.data;
};
export default api;
