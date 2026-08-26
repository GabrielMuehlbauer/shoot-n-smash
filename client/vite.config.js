import { fileURLToPath } from 'node:url';

import { defineConfig, loadEnv } from 'vite';

const PROJECT_ROOT = fileURLToPath(new URL('../', import.meta.url));

export default defineConfig(({ mode }) => {
  const rootEnvironment = loadEnv(mode, PROJECT_ROOT, '');
  const apiHost = rootEnvironment.HOST || '127.0.0.1';
  const apiPort = rootEnvironment.PORT || '3000';

  return {
    server: {
      host: '0.0.0.0',
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': {
          target: `http://${apiHost}:${apiPort}`,
          changeOrigin: true,
        },
      },
    },
    preview: {
      host: '0.0.0.0',
      port: 4173,
      strictPort: true,
    },
  };
});
