import { initTauriBridge } from '../../src/tauriBridge'
initTauriBridge()

import {
    QueryClient,
    QueryClientProvider
} from "@tanstack/react-query"
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from "react-redux"
import '../../src/assets/index.css'
import renderStore from "../../src/redux/renderStore"
import App from "./App"

const queryClient = new QueryClient()

createRoot(document.getElementById('root')).render(<StrictMode>
    <QueryClientProvider client={queryClient}>
        <Provider store={renderStore}>
            <App />
        </Provider>
    </QueryClientProvider>
</StrictMode>)
