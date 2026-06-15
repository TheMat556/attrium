import path from 'node:path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  base: '/wp-content/plugins/attrium/app/dist/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  build: {
    outDir: 'app/dist',
    manifest: true,
    cssCodeSplit: false,
    rollupOptions: {
      input: 'src/main.ts'
    }
  }
})
