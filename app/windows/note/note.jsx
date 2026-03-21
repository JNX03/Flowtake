import { initTauriBridge } from '@shared/tauriBridge'
initTauriBridge()

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@shared/assets/index.css'
import App from "./App"

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>)
