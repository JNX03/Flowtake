import { useQuery } from "@tanstack/react-query"
import { useState, useEffect } from "react"
import PickerWrapper from "../../components/PickerWrapper"
import WindowOutline from "./components/WindowOutline"

export default function App() {

    const [bgImage, setBgImage] = useState(null)

    // Fetch the pre-captured desktop screenshot
    useEffect(() => {
        window.electron.ipcRenderer.invoke("get-picker-screenshot")
            .then(dataUrl => { if (dataUrl) setBgImage(dataUrl) })
            .catch(() => {
                // Fallback: use get-source-screenshot
                window.electron.ipcRenderer.invoke("get-source-screenshot", { type: "screen" })
                    .then(dataUrl => { if (dataUrl) setBgImage(dataUrl) })
                    .catch(e => console.warn("[WindowPicker] Screenshot failed:", e))
            })
    }, [])

    const { data: windows, isPending, isError } = useQuery({
        queryKey: ['windows'],
        queryFn: () => window.electron.ipcRenderer.invoke("get-windows"),
        staleTime: Infinity
    })

    // Filter out the window picker itself and any Flowtake windows
    const filteredWindows = windows?.filter(w => {
        const name = (w.name || '').toLowerCase()
        return name !== 'select window' && name !== 'select window - flowtake'
    }) || []

    const drawOutlines = () =>
        filteredWindows.map((win, i) => {
            return <WindowOutline
                onClick={() => onSelect(win)}
                dimensions={win}
                label={win.name}
                key={i}
            />
        })

    const onCancel = () => window.electron.ipcRenderer.invoke("close-window-picker-window")

    const onSelect = selectedWindow => window.electron.ipcRenderer.invoke("select-window", selectedWindow)

    return (<PickerWrapper onCancel={onCancel}>
        {bgImage && <img src={bgImage} className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none" alt="" draggable={false} />}
        <div className="absolute inset-0 bg-black/30 pointer-events-none" />
        {!isPending && !isError && drawOutlines()}
    </PickerWrapper>)
}
