import axios from 'axios';
import { fetch } from '@tauri-apps/plugin-http';

const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://168.144.46.137:8080';

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
