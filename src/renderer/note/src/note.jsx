import log from 'electron-log/renderer'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../../src/assets/index.css'
import { initSentry } from "../../src/sentryHelpers"
import App from "./App"

await initSentry()
Object.assign(console, log.functions)

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>)
