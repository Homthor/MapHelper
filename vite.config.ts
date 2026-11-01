import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '::',
    port: 5173,
    open: false,
    proxy: {
      '/ymaps-proxy': {
        target: 'https://api-maps.yandex.ru',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/ymaps-proxy/, ''),
        headers: {
          Referer: 'http://localhost:5173/'
        }
      }
    }
  }
});
