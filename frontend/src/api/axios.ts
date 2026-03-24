import { invoke } from '@tauri-apps/api/core';

const API_BASE = 'http://168.144.46.137:8080';

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

  private async request(
    method: string,
    url: string,
    data?: unknown,
    config?: ApiConfig
  ): Promise<ApiResponse> {
    const fullUrl = this.getFullUrl(url, config);
    
    // Use Tauri command for API calls
    try {
      if (method === 'GET') {
        const result = await invoke<{data: unknown; status: number; status_text: string}>('api_get', { url: fullUrl });
        return {
          data: result.data,
          status: result.status,
          statusText: result.status_text,
          headers: {},
        };
      } else {
        const body = data ? JSON.stringify(data) : '{}';
        const result = await invoke<{data: unknown; status: number; status_text: string}>('api_post', { url: fullUrl, body });
        return {
          data: result.data,
          status: result.status,
          statusText: result.status_text,
          headers: {},
        };
      }
    } catch (err) {
      console.error('[API] Tauri invoke error:', err);
      throw err;
    }
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
export default api;
