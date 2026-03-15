import { useQuery } from "@tanstack/react-query"
import { useState, useCallback } from "react"
import PickerWrapper from "../../components/PickerWrapper"
import WindowOutline from "./components/WindowOutline"

export default function App() {
    const [activeWindow, setActiveWindow] = useState(null)

    const { data: windows, isPending, isError } = useQuery({
        queryKey: ['windows'],
        queryFn: () => window.electron.ipcRenderer.invoke("get-windows"),
        staleTime: Infinity
    })

    // Find the topmost window under the cursor
    // windows are in z-order (topmost first from EnumWindows)
    const handleMouseMove = useCallback((e) => {
        if (!windows) return
        const x = e.clientX
        const y = e.clientY

        // Find topmost window containing this point
        const found = windows.find(win =>
            x >= win.x && x <= win.x + win.width &&
            y >= win.y && y <= win.y + win.height
        )
        setActiveWindow(found || null)
    }, [windows])

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
            {/* Cancel bar at top */}
            <div className="absolute z-10 w-full top-0 flex justify-center pt-1 pointer-events-none">
                <div className="flex items-center gap-3 px-3 py-2 bg-base-300 rounded-xl shadow-lg pointer-events-auto"
                    onClick={(e) => { e.stopPropagation(); onCancel(); }}>
                    <button className="btn btn-sm btn-error">Cancel</button>
                    {activeWindow && (
                        <span className="text-sm text-base-content truncate max-w-[400px]">
                            {activeWindow.name}
                        </span>
                    )}
                    {!activeWindow && !isPending && (
                        <span className="text-sm text-base-content/50">Move mouse over a window</span>
                    )}
                    {isPending && (
                        <span className="loading loading-spinner loading-sm"></span>
                    )}
                </div>
            </div>

            {/* Show outline only for the window under cursor */}
            {activeWindow && (
                <WindowOutline
                    dimensions={activeWindow}
                    name={activeWindow.name}
                />
            )}
        </div>
    )
}
