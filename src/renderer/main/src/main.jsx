import log from 'electron-log/renderer'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from "react-redux"
import {
    QueryClient,
    QueryClientProvider
} from '@tanstack/react-query'
import '../../src/assets/index.css'
import store from "../../src/redux/store"
import { initSentry } from "../../src/sentryHelpers"
import App from "./App"

const queryClient = new QueryClient()

await initSentry()
Object.assign(console, log.functions)

createRoot(document.getElementById('root')).render(
    <StrictMode>
        <QueryClientProvider client={queryClient}>
            <Provider store={store}>
                <App />
            </Provider>
        </QueryClientProvider>
    </StrictMode>
)