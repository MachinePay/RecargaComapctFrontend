import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Em desenvolvimento o /api vai para o backend local (sem precisar de CORS).
// host: true deixa o tablet da bancada abrir pelo IP do PC.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    proxy: {
      '/api': 'http://127.0.0.1:8000',
    },
  },
})
