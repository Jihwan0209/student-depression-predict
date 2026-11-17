import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 }, // Spring @CrossOrigin 에 등록된 주소와 같아야 함
})
