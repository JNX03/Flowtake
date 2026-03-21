import tailwindcss from "@tailwindcss/vite"
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { defineConfig } from 'vite'
import { normalizePath } from "vite"
import { viteStaticCopy } from "vite-plugin-static-copy"

const host = process.env.TAURI_DEV_HOST

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    viteStaticCopy({
      targets: [
        {
          src: normalizePath(resolve(__dirname, 'node_modules/@mediapipe/tasks-vision/wasm/*')),
          dest: 'selfie_segmentation/wasm'
        }
      ]
    })
  ],

  resolve: {
    alias: {
      '@shared': resolve('app/shared')
    }
  },

  assetsInclude: ['**/*.tflite', '**/*.frag', '**/*.vert', '**/*.wgsl'],

  // Vite options tailored for Tauri development
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
        protocol: "ws",
        host,
        port: 5174,
      }
      : undefined,
    watch: {
      // Tell vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },

  // Env variables starting with TAURI_ and VITE_ are exposed
  envPrefix: ['VITE_', 'TAURI_ENV_*'],

  build: {
    outDir: 'dist',
    // Tauri uses Chromium on Windows and WebKit on macOS/Linux
    target: process.env.TAURI_ENV_PLATFORM === 'windows' ? 'chrome105' : 'safari13',
    // Don't minify for debug builds
    minify: !process.env.TAURI_ENV_DEBUG ? 'esbuild' : false,
    // Produce sourcemaps for debug builds
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        areaPicker: resolve(__dirname, 'app/windows/areaPicker/index.html'),
        note: resolve(__dirname, 'app/windows/note/index.html'),
        recorder: resolve(__dirname, 'app/windows/recorder/index.html'),
        windowPicker: resolve(__dirname, 'app/windows/windowPicker/index.html'),
        exporter: resolve(__dirname, 'app/windows/exporter/index.html'),
      }
    }
  },

  worker: {
    format: 'es'
  }
})
