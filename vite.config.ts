import { fileURLToPath, URL } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // JELLYFIN_URL (for example in .env.local) proxies a real Jellyfin Web install so the harness can load its styles.
  const jellyfinUrl = loadEnv(mode, fileURLToPath(new URL('.', import.meta.url)), 'JELLYFIN_').JELLYFIN_URL;
  return {
    root: fileURLToPath(new URL('./src/config/dev', import.meta.url)),
    plugins: [vue()],
    server: {
      host: '127.0.0.1',
      port: 5174,
      strictPort: true,
      proxy: jellyfinUrl ? { '/web': { target: jellyfinUrl, changeOrigin: true, secure: true } } : undefined
    }
  };
});
