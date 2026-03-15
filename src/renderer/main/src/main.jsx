import { initTauriBridge } from '../../src/tauriBridge'

// Initialize Tauri bridge BEFORE any code that uses window.electron
initTauriBridge()

import React from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from "react-redux"
import {
    QueryClient,
    QueryClientProvider
} from '@tanstack/react-query'
import '../../src/assets/index.css'
import store from "../../src/redux/store"
import App from "./App"

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

createRoot(document.getElementById('root')).render(
    <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
            <Provider store={store}>
                <App />
            </Provider>
        </QueryClientProvider>
    </ErrorBoundary>
)

// Show main window and dismiss splash as soon as React commits
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
requestAnimationFrame(() => {
    getCurrentWebviewWindow().show().catch(() => {})
    const splash = document.getElementById('splash')
    if (splash) {
        splash.classList.add('removing')
        setTimeout(() => splash.remove(), 200)
    }
})
