import { useQuery } from "@tanstack/react-query"
import PickerWrapper from "../../components/PickerWrapper"
import WindowOutline from "./components/WindowOutline"

export default function App() {

    const { data: windows, isPending, isError } = useQuery({
        queryKey: ['windows'],
        queryFn: () => window.electron.ipcRenderer.invoke("get-windows"),
        staleTime: Infinity
    })

    const drawOutlines = () =>
        windows.map((win, i) => {
            return <WindowOutline
                onClick={() => onSelect({ name: win.name, id: win.id, type: win.type, x: win.x, y: win.y, width: win.width, height: win.height })}
                dimensions={win}
                key={i}
            />
        })

    const onCancel = () => window.electron.ipcRenderer.invoke("close-window-picker-window")

    const onSelect = selectedWindow => window.electron.ipcRenderer.invoke("select-window", selectedWindow)

    return (<PickerWrapper onCancel={onCancel}>
        {!isPending && !isError && windows && drawOutlines()}
    </PickerWrapper>)
}
