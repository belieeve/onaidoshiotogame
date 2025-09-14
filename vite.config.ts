import { defineConfig } from 'vite'

export default defineConfig({
  // Use relative base so all assets resolve under GitHub Pages subdirectory
  base: './',
  server: {
    port: 5173,
    open: false
  },
  build: {
    sourcemap: true
  }
})
