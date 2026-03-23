import axios, { type AxiosRequestConfig } from 'axios';

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

export const checkHealthNative = async () => {
  try {
    const response = await axios.get(`${baseURL}/api/health`, { timeout: 5000 });
    return response.status === 200;
  } catch {
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
