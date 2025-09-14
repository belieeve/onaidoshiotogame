import { defineConfig } from 'vite'

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/onaidoshiotogame/' : '/',
  server: {
    port: 5173,
    open: false
  },
  build: {
    sourcemap: true
  }
})
