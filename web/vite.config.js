import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: /^\.\.\/apkgImport(?:\.js)?$/,
        replacement: fileURLToPath(new URL('./src/apkgImportCompat.js', import.meta.url)),
      },
    ],
  },
})
