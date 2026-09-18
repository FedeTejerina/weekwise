import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // The API (server/src/server.ts) runs separately on 3000 (`npm run dev:api`); relative
      // `fetch('/api/...')` calls from the browser go through this in dev.
      '/api': 'http://localhost:3000',
    },
  },
});
