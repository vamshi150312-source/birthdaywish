import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// host: true lets phones on the same Wi-Fi open the app; /api is proxied to Spring Boot so links work from any device.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, host: true, proxy: { '/api': 'http://localhost:8080' } }
})
