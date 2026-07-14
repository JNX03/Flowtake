import tailwindcss from "@tailwindcss/vite"
import react from '@vitejs/plugin-react'
import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'
import { defineConfig } from 'vite'
import { normalizePath } from "vite"
import { viteStaticCopy } from "vite-plugin-static-copy"

const host = process.env.TAURI_DEV_HOST

const mediapipeWasmDir = resolve(__dirname, 'node_modules/@mediapipe/tasks-vision/wasm')

const serveMediapipeWasmInDev = {
  name: 'serve-mediapipe-wasm-in-dev',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use('/selfie_segmentation/wasm', (req, res, next) => {
      const requested = (req.url || '').split('?')[0]
      const abs = resolve(mediapipeWasmDir, '.' + requested)
      if (!abs.startsWith(mediapipeWasmDir) || !existsSync(abs)) return next()
      res.setHeader('Content-Type', abs.endsWith('.wasm') ? 'application/wasm' : 'application/javascript')
      res.end(readFileSync(abs))
    })
  }
}

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    serveMediapipeWasmInDev,
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
    },
    dedupe: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime']
  },

  // Vite's default scan does not discover worker-only scene dependencies until
  // the first recording opens. Scan both workers up front so dependency
  // optimization stays in one generation and cannot force a reload behind the
  // editor's unsaved-work guard during that first handoff.
  optimizeDeps: {
    entries: [
      'index.html',
      'app/windows/**/index.html',
      'app/shared/workers/previewWorker.js',
      'app/shared/workers/renderWorker.js',
    ],
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
    target: process.env.TAURI_ENV_PLATFORM === 'windows' ? 'chrome105' : 'safari15',
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
        liveOverlay: resolve(__dirname, 'app/windows/liveOverlay/index.html'),
        windowPicker: resolve(__dirname, 'app/windows/windowPicker/index.html'),
        exporter: resolve(__dirname, 'app/windows/exporter/index.html'),
        drawing: resolve(__dirname, 'app/windows/drawing/index.html'),
        liveComposer: resolve(__dirname, 'app/windows/liveComposer/index.html'),
      }
    }
  },

  worker: {
    format: 'es',
    plugins: () => []
  }
})
