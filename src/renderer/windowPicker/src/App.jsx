import { useState, useCallback, useRef } from "react"
import { XMarkIcon } from "@heroicons/react/20/solid"
import WindowOutline from "./components/WindowOutline"

export default function App() {
    const [activeWindow, setActiveWindow] = useState(null)
    const lastCallTime = useRef(0)
    const pendingCall = useRef(false)

    // Throttled call to get_window_at_point (every 100ms)
    const handleMouseMove = useCallback((e) => {
        const now = Date.now()
        if (now - lastCallTime.current < 100 || pendingCall.current) return

        pendingCall.current = true
        lastCallTime.current = now

        // Convert logical screen coords to physical (matching Rust GetWindowRect)
        const dpr = window.devicePixelRatio || 1
        const screenX = Math.round(e.screenX * dpr)
        const screenY = Math.round(e.screenY * dpr)

        window.electron.ipcRenderer.invoke("get-window-at-point", screenX, screenY)
            .then(win => {
                setActiveWindow(win)
                pendingCall.current = false
            })
            .catch(() => {
                pendingCall.current = false
            })
    }, [])

    const onCancel = () => window.electron.ipcRenderer.invoke("close-window-picker-window")

    const onSelect = () => {
        if (!activeWindow) return
        window.electron.ipcRenderer.invoke("select-window", {
            name: activeWindow.name,
            id: activeWindow.id,
            type: activeWindow.type,
            x: activeWindow.x,
            y: activeWindow.y,
            width: activeWindow.width,
            height: activeWindow.height
        })
    }

    return (
        <div
            className="h-full w-full relative overflow-hidden"
            style={{ background: 'transparent' }}
            onMouseMove={handleMouseMove}
            onClick={onSelect}
        >
            {/* Cancel bar + active window name */}
            <div className="absolute z-10 w-full top-0 flex justify-center pt-1 pointer-events-none">
                <div className="flex items-center gap-3 px-4 py-2 bg-base-300 rounded-xl shadow-lg pointer-events-auto">
                    <button className="btn btn-sm btn-error" onClick={(e) => { e.stopPropagation(); onCancel(); }}>
                        <XMarkIcon className="h-4 w-4" /> Cancel
                    </button>
                    {activeWindow && (
                        <span className="text-sm text-base-content truncate max-w-[400px]">
                            {activeWindow.name}
                        </span>
                    )}
                    {!activeWindow && (
                        <span className="text-sm text-base-content/50">Hover over a window to select it</span>
                    )}
                </div>
            </div>

            {/* Highlight the detected window */}
            {activeWindow && (
                <WindowOutline dimensions={activeWindow} name={activeWindow.name} />
            )}
        </div>
    )
}
