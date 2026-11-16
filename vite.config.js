import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { workspaceFileStorage } from './server/workspaceFile.js';

// base './' keeps asset and guide links relative, so the built site works from any folder.
// workspaceFileStorage() saves your data to michelle-for-stride/workspace-data while the app runs.
export default defineConfig({
  base: './',
  plugins: [react(), workspaceFileStorage()],
});
