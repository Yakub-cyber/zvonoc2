import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Замените repo-name на ИМЯ_РЕПОЗИТОРИЯ
export default defineConfig({
	plugins: [react()],
	base: 'zvonoc2', // например "/webrtc-audio/"
})
