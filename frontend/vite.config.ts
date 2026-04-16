/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://168.144.46.137:8080', // your backend
        changeOrigin: true,
        secure: false,
      },
    },
  },
  appBase: '/',
  test: {
    environment: 'jsdom',
  },
});
