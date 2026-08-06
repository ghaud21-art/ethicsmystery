import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 가비아에서 구입한 ethicsmystery.com 커스텀 도메인으로 루트 배포.
export default defineConfig({
  plugins: [react()],
  base: '/',
})
