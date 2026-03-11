import { initTauriBridge } from '../../src/tauriBridge'

// Initialize Tauri bridge BEFORE anything else
initTauriBridge()

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from "react-redux"
import {
    QueryClient,
    QueryClientProvider
} from '@tanstack/react-query'
import '../../src/assets/index.css'
import store from "../../src/redux/store"
import { initSentry } from "../../src/sentryHelpers.tauri"
import App from "./App"

const queryClient = new QueryClient()

await initSentry()

createRoot(document.getElementById('root')).render(
    <StrictMode>
        <QueryClientProvider client={queryClient}>
            <Provider store={store}>
                <App />
            </Provider>
        </QueryClientProvider>
    </StrictMode>
)
