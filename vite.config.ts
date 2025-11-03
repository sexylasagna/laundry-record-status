import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Listen on all network interfaces
    port: 5173,
    proxy: {
      '/api/loyverse': {
        target: 'https://api.loyverse.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/loyverse/, '/v1.0'),
        secure: true,
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            // Forward Authorization header from the original request
            const authHeader = req.headers.authorization;
            if (authHeader) {
              proxyReq.setHeader('Authorization', authHeader);
            }
          });
        },
      },
    },
  },
});


