import { useQuery } from "@tanstack/react-query"
import PickerWrapper from "../../components/PickerWrapper"
import WindowOutline from "./components/WindowOutline"

export default function App() {

    const { data: windows, isPending, isError } = useQuery({
        queryKey: ['windows'],
        queryFn: () => window.electron.ipcRenderer.invoke("get-windows"),
        staleTime: Infinity
    })

    const drawOutlines = () => {
        if (!windows || windows.length === 0) return null

        // Filter occluded windows (completely hidden behind another)
        const visible = windows.filter((win, i) => {
            return !windows.slice(0, i).some(other =>
                other.x <= win.x && other.y <= win.y &&
                other.x + other.width >= win.x + win.width &&
                other.y + other.height >= win.y + win.height
            )
        })

        // Reverse so topmost window renders last (on top)
        const reversed = [...visible].reverse()

        return reversed.map((win, i) => (
            <WindowOutline
                onClick={() => onSelect({ name: win.name, id: win.id, type: win.type, x: win.x, y: win.y, width: win.width, height: win.height })}
                dimensions={win}
                name={win.name}
                key={i}
            />
        ))
    }

    const onCancel = () => window.electron.ipcRenderer.invoke("close-window-picker-window")

    const onSelect = selectedWindow => window.electron.ipcRenderer.invoke("select-window", selectedWindow)

    return (<PickerWrapper onCancel={onCancel}>
        {!isPending && !isError && windows && drawOutlines()}
    </PickerWrapper>)
}
