import { defineConfig } from 'vite';
// Relative base so the built game can be hosted from any static folder.
export default defineConfig({ base: './', build: { chunkSizeWarningLimit: 900 } });
