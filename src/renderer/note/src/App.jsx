import { useEffect, useState } from "react"
import TitleBar from "../../components/TitleBar"
import { MagnifyingGlassMinusIcon, MagnifyingGlassPlusIcon, XMarkIcon } from "@heroicons/react/16/solid"

export default function App() {

    const sizes = ["textarea-xs", "textarea-sm", "textarea-base", "textarea-lg", "textarea-xl"]

    const [size, setSize] = useState(1)
    const [isAlertVisible, setIsAlertVisible] = useState(true)
    const [isRecording, setIsRecording] = useState(false)

    useEffect(() => {
        window.electron.ipcRenderer.once('recording-started', () => setIsRecording(true))
        window.electron.ipcRenderer.once('recording-stopped', () => setIsRecording(false))
    }, [])

    const increaseSize = () => setSize(Math.min(size + 1, sizes.length - 1))
    const decreaseSize = () => setSize(Math.max(size - 1, 0))
    const dismissAlert = () => setIsAlertVisible(false)

    return (<>
        <TitleBar overlayButtons={2} title="Note" >
            <span className="join mt-1">
                <button className={`btn btn-xs join-item ${isRecording ? "cursor-default" : ""}`}
                    onClick={decreaseSize} disabled={size === 0}>
                    <MagnifyingGlassMinusIcon className="size-4" />
                </button>
                <button className={`btn btn-xs join-item ${isRecording ? "cursor-default" : ""}`}
                    onClick={increaseSize} disabled={size === sizes.length - 1}>
                    <MagnifyingGlassPlusIcon className="size-4" />
                </button>
            </span>
        </TitleBar>
        <div className="flex h-full w-full p-1">
            <textarea
                className={`textarea ${sizes[size]} flex-1 resize-none ${isRecording ? "cursor-default" : ""}`}
                placeholder="Type something..." />
        </div>
        {isAlertVisible && <div className={`fixed left-0 bottom-0 w-full ${isRecording ? "cursor-default" : ""}`}>
            <div className="alert alert-warning text-xs w-full grid-flow-col text-left rounded-b-none">
                <span className="text-wrap">Add notes that will be visible but won&apos;t be recorded.
                    <br />Move this window near your camera for optimal results.</span>
                <div className="flex items-center">
                    <button className={`btn btn-sm btn-ghost ml-1 ${isRecording ? "cursor-default" : ""}`}
                        onClick={dismissAlert}><XMarkIcon className="size-4" /></button>
                </div>
            </div>
        </div>}
    </>)
}

