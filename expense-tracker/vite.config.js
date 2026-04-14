import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // './' makes all asset paths relative — required for:
  //  • Opening dist/index.html directly (file://) on local PC
  //  • GitHub Pages hosted at a subdirectory (e.g. username.github.io/expense-tracker/)
  base: './',
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
