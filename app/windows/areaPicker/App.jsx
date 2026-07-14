import { useState, useEffect, useCallback } from "react"
import { AreaSelector } from "@bmunozg/react-image-area"
import { CursorArrowRaysIcon } from "@heroicons/react/24/outline"
import PickerWrapper from "../../components/PickerWrapper"
import { loadPickerImageSrc, releasePickerImageSrc } from "../pickerImage"

export default function App() {

    const MIN_WIDTH = 10
    const MIN_HEIGHT = 10

    const [areas, setAreas] = useState([])
    const [bgImage, setBgImage] = useState(null)
    const [loadError, setLoadError] = useState(false)
    const [loadAttempt, setLoadAttempt] = useState(0)

    // Fetch the pre-captured screenshot (captured by Rust before this window opened)
    useEffect(() => {
        let imageSrc
        setLoadError(false)
        window.electron.ipcRenderer.invoke("get-picker-screenshot")
            .then(loadPickerImageSrc)
            .then(src => {
                imageSrc = src
                if (src) setBgImage(src)
            })
            .catch(e => {
                console.warn("[AreaPicker] Screenshot failed:", e)
                setLoadError(true)
            })

        return () => releasePickerImageSrc(imageSrc)
    }, [loadAttempt])

    const onCancel = useCallback(() => window.electron.ipcRenderer.invoke("close-area-picker-window"), [])

    const onSelect = useCallback(() => {
        if (!areas[0]) return
        window.electron.ipcRenderer.invoke("select-area", { ...areas[0], type: "area", name: "Area" })
    }, [areas])

    useEffect(() => {
        const handleKeyDown = event => {
            if (event.key === "Escape") onCancel()
            if (event.key === "Enter" && areas[0]) onSelect()
        }
        window.addEventListener("keydown", handleKeyDown)
        return () => window.removeEventListener("keydown", handleKeyDown)
    }, [areas, onCancel, onSelect])

    const customRender = areaProps => {
        return (<div key={areaProps.areaNumber}
            className={`w-full h-full border-4 transition-colors ${areaProps.isChanging ? "border-primary/70" : "border-primary bg-primary/5"}`} />)
    }

    const hasArea = !!areas[0]

    return (<PickerWrapper
        onCancel={onCancel}
        instruction={hasArea ? "Selection ready - press Enter or confirm below" : "Drag anywhere to select the recording area"}>
        <AreaSelector areas={areas} maxAreas={1} minWidth={MIN_WIDTH} minHeight={MIN_HEIGHT}
            unit="percentage" onChange={setAreas}
            customAreaRenderer={customRender}>
            {loadError
                ? <div className="w-screen h-screen bg-base-300 flex flex-col items-center justify-center gap-3">
                    <p className="text-sm text-base-content/70">The screen preview could not load.</p>
                    <button type="button" className="btn btn-sm btn-primary" onClick={() => setLoadAttempt(value => value + 1)}>
                        Try again
                    </button>
                </div>
                : bgImage
                ? <img src={bgImage} className="w-screen h-screen object-cover select-none" alt="" draggable={false} />
                : <div className="w-screen h-screen bg-base-300 flex items-center justify-center">
                    <span className="loading loading-spinner loading-lg"></span>
                </div>}
        </AreaSelector>
        {hasArea && (
            <div className="absolute inset-x-0 bottom-5 z-20 flex justify-center pointer-events-none">
                <button type="button" onClick={onSelect} className="btn btn-primary shadow-xl pointer-events-auto min-h-12 px-6">
                    <CursorArrowRaysIcon className="h-5 w-5" />
                    Record this area
                </button>
            </div>
        )}
    </PickerWrapper>)
}
