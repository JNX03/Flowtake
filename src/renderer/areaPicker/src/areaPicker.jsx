import { initTauriBridge } from '../../src/tauriBridge'
initTauriBridge()

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../../src/assets/index.css'
import App from "./App"

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>)
