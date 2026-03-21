import { initTauriBridge } from '@shared/tauriBridge'

// Stage 1: Initialize Tauri bridge
initTauriBridge()
if (window.splashUpdate) window.splashUpdate('bridge')

// Load saved theme early so there's no flash of default theme
window.electron.ipcRenderer.invoke("store-get", "appearance-theme")
    .then((theme) => {
        if (theme) document.documentElement.setAttribute("data-theme", theme)
    })
    .catch(() => {})

// Start FFmpeg discovery EARLY (runs in parallel with React setup + render)
const earlyCapturers = window.electron.ipcRenderer.invoke("get-capturers").catch(() => [])
const earlyEncoders = window.electron.ipcRenderer.invoke("get-encoders").catch(() => [])
window.__earlyData = { capturers: earlyCapturers, encoders: earlyEncoders }

// Stage 2: Load framework
import React from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from "react-redux"
import {
    QueryClient,
    QueryClientProvider
} from '@tanstack/react-query'
import '@shared/assets/index.css'
if (window.splashUpdate) window.splashUpdate('framework')

// Stage 3: Create store
import store from "@shared/redux/store"
import App from "./App"
if (window.splashUpdate) window.splashUpdate('store')

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props)
        this.state = { hasError: false, error: null }
    }
    static getDerivedStateFromError(error) {
        return { hasError: true, error }
    }
    componentDidCatch(error, info) {
        console.error('[ErrorBoundary]', error, info)
    }
    render() {
        if (this.state.hasError) {
            return <pre style={{ color: 'red', padding: 20, fontSize: 14, whiteSpace: 'pre-wrap' }}>
                {this.state.error?.toString()}
                {'\n\n'}
                {this.state.error?.stack}
            </pre>
        }
        return this.props.children
    }
}

const queryClient = new QueryClient()

// Stage 4: Render
createRoot(document.getElementById('root')).render(
    <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
            <Provider store={store}>
                <App />
            </Provider>
        </QueryClientProvider>
    </ErrorBoundary>
)

// Show main window after React commits, but let App.jsx handle splash dismissal
// after early data resolves
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
requestAnimationFrame(() => {
    if (window.splashUpdate) window.splashUpdate('render')
    getCurrentWebviewWindow().show().catch(() => {})
})
