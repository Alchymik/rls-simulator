import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  server: {
    port: 5173,
    proxy: { '/api': { target: 'http://127.0.0.1:3001', changeOrigin: true } },
  },
  build: {
    target: 'baseline-widely-available',
    // Карты исходников в поставку не попадают: они только увеличивают дистрибутив
    sourcemap: mode !== 'production',
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'leaflet', test: /node_modules[\\/](leaflet|react-leaflet)/ },
            { name: 'charts',  test: /node_modules[\\/]recharts/ },
          ],
        },
      },
    },
  },
}));
