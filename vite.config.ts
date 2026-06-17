import path from 'node:path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  base: '/wp-content/plugins/attrium/app/dist/',
  resolve: {
    alias: [
      // Real reka-ui entry, addressed directly so the portal shim can re-export
      // it without recursing through the `reka-ui` alias below.
      {
        find: '@reka-ui/original',
        replacement: path.resolve(__dirname, './node_modules/reka-ui/dist/index.js')
      },
      // Redirect bare `reka-ui` imports to our portal shim so teleported content
      // (dialogs, dropdowns, tooltips) renders inside the shadow root.
      {
        find: /^reka-ui$/,
        replacement: path.resolve(__dirname, './src/lib/reka-ui.ts')
      },
      { find: '@', replacement: path.resolve(__dirname, './src') }
    ]
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
