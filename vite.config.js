import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages 서브경로 배포용. 가비아 커스텀 도메인 연결 시 이 값만 '/'로 바꾸면 됨.
export default defineConfig({
  plugins: [react()],
  base: '/ethicsmystery/',
})
