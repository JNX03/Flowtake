import { initTauriBridge } from '@shared/tauriBridge'

// Initialize Tauri bridge BEFORE anything else
initTauriBridge()

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from "react-redux"
import {
    QueryClient,
    QueryClientProvider
} from '@tanstack/react-query'
import '@shared/assets/index.css'
import store from "@shared/redux/store"
import { initSentry } from "@shared/sentryHelpers.tauri"
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
