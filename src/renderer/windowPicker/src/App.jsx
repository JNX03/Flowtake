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
        windows.map((window, i) => {
            const { name, id, type } = window
            return <WindowOutline onClick={() => onSelect({ name, id, type })} dimensions={window} key={i} />
        })

    const onCancel = () => window.electron.ipcRenderer.invoke("close-window-picker-window")

    const onSelect = selectedWindow => window.electron.ipcRenderer.invoke("select-window", selectedWindow)

    return (<PickerWrapper onCancel={onCancel}>
        {!isPending && !isError && windows && drawOutlines()}
    </PickerWrapper>)
}