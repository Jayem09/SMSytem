import axios, { type AxiosRequestConfig } from 'axios';
import { fetch } from '@tauri-apps/plugin-http';

declare global {
  interface Window {
    __TAURI__?: any;
    __TAURI_INTERNALS__?: any;
  }
}

const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://168.144.46.137:8080';

export interface RequestConfig extends AxiosRequestConfig {
  signal?: AbortSignal;
}

// For health checks and critical auth, we'll try native bridge first (to bypass CORS in production)
// and fallback to regular axios if the bridge is missing (e.g. in dev).
export const checkHealthNative = async () => {
  // 1. Try Native Bridge (Tauri Plugin HTTP)
  try {
    const response = await fetch(`${baseURL}/api/health`, { 
      method: 'GET', 
      connectTimeout: 5000 
    });
    if (response.ok) return true;
  } catch (err) {
    console.warn('Native Bridge failed or missing, trying regular axios:', err);
  }

  // 2. Fallback to regular Axios (Works in dev, might be blocked in prod but covers both bases)
  try {
    const response = await axios.get(`${baseURL}/api/health`, { timeout: 5000 });
    return response.status === 200;
  } catch (err) {
    console.error('All health checks failed:', err);
    return false;
  }
};

export const createAbortController = (): AbortController => {
  return new AbortController();
};

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
  adapter: async (config) => {
    // Check if we're in Tauri environment using multiple detection methods
    const isTauri = typeof window !== 'undefined' && (
      typeof window.__TAURI__ !== 'undefined' ||
      typeof window.__TAURI_INTERNALS__ !== 'undefined' ||
      (typeof window !== 'undefined' && (window as any).TAURI?.http) ||
      document.location.protocol === 'tauri:' ||
      document.location.protocol === 'ipc:'
    );
    
    if (!isTauri) {
      const defaultAdapter = axios.getAdapter(axios.defaults.adapter as any);
      return (defaultAdapter as any)(config);
    }

    // Try to use @tauri-apps/plugin-http
    try {
      let fetchFn = globalThis.fetch;
      
      // Try to import Tauri HTTP plugin
      try {
        const httpModule = await import('@tauri-apps/plugin-http');
        fetchFn = httpModule.fetch;
      } catch {
        // Fall back to global fetch if plugin not available
      }

      const fullUrl = config.url?.startsWith('http') 
        ? config.url 
        : `${config.baseURL}${config.url}${config.params ? '?' + new URLSearchParams(config.params).toString() : ''}`;

      const plainHeaders: Record<string, string> = {};
      if (config.headers) {
        Object.entries(config.headers).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            plainHeaders[key] = String(value);
          }
        });
      }

      const isUsingTauriHttp = fetchFn !== globalThis.fetch;
      
      const requestInit: RequestInit & { connectTimeout?: number } = {
        method: (config.method?.toUpperCase() as any) || 'GET',
        headers: plainHeaders,
        body: config.data ? (typeof config.data === 'string' ? config.data : JSON.stringify(config.data)) : undefined,
      };
      
      if (isUsingTauriHttp) {
        requestInit.connectTimeout = config.timeout || 10000;
      }
      
      const tauriResponse = await fetchFn(fullUrl, requestInit);

      const responseText = await tauriResponse.text();
      
      if (!tauriResponse.ok) {
        let errorData;
        try {
          errorData = JSON.parse(responseText);
        } catch {
          errorData = { error: responseText || `HTTP ${tauriResponse.status}` };
        }
        return {
          data: errorData,
          status: tauriResponse.status,
          statusText: tauriResponse.statusText,
          headers: tauriResponse.headers as any,
          config,
        };
      }

      let responseData = null;
      if (responseText.trim()) {
        responseData = JSON.parse(responseText);
      }

      return {
        data: responseData,
        status: tauriResponse.status,
        statusText: tauriResponse.statusText,
        headers: tauriResponse.headers as any,
        config,
      };
    } catch (error: any) {
      console.error('Tauri Native Request Failed:', error);
      const defaultAdapter = axios.getAdapter(axios.defaults.adapter as any);
      return (defaultAdapter as any)(config);
    }
  }
});


api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);


api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const isAuthPage = window.location.pathname === '/login' || window.location.pathname === '/register';
      if (!isAuthPage) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
