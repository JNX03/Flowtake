import { sentryVitePlugin } from "@sentry/vite-plugin"
import tailwindcss from "@tailwindcss/vite"
import react from '@vitejs/plugin-react'
import { bytecodePlugin, defineConfig, externalizeDepsPlugin } from 'electron-vite'
import { resolve } from 'path'
import { normalizePath } from "vite"
import { viteStaticCopy } from "vite-plugin-static-copy"

const sentry = sentryVitePlugin({
  org: "flowtake",
  project: "app",
  authToken: process.env.SENTRY_AUTH_TOKEN,
})

export default defineConfig({
  main: {
    plugins: [bytecodePlugin(), externalizeDepsPlugin(), sentry],
    sourcemap: true
  },
  preload: {
    plugins: [bytecodePlugin(), externalizeDepsPlugin(), sentry],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/preload/index.js'),
        },
      },
      sourcemap: true
    }
  },
  renderer: {
    assetsInclude: ['**/*.tflite', '**/*.frag', '**/*.vert', '**/*.wgsl'],
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [tailwindcss(), react(), viteStaticCopy({
      targets: [
        {
          src: normalizePath(resolve(__dirname, 'node_modules/@mediapipe/tasks-vision/wasm/*')),
          dest: 'selfie_segmentation/wasm'
        }
      ]
    }), sentry],
    build: {
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'src/renderer/main/index.html'),
          areaPicker: resolve(__dirname, 'src/renderer/areaPicker/index.html'),
          note: resolve(__dirname, 'src/renderer/note/index.html'),
          record: resolve(__dirname, 'src/renderer/recorder/index.html'),
          windowPicker: resolve(__dirname, 'src/renderer/windowPicker/index.html'),
          exporter: resolve(__dirname, 'src/renderer/exporter/index.html'),
        }
      },
      sourcemap: true
    },
    worker: {
      format: 'es',
      plugins: () => [...sentry]
    }
  }
})
