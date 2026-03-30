import { useState, useEffect } from "react"
import { AreaSelector } from "@bmunozg/react-image-area"
import { CursorArrowRaysIcon } from "@heroicons/react/24/outline"
import { convertFileSrc } from "@tauri-apps/api/core"
import PickerWrapper from "../../components/PickerWrapper"

export default function App() {

    const MIN_WIDTH = 10
    const MIN_HEIGHT = 10

    const [areas, setAreas] = useState([])
    const [bgImage, setBgImage] = useState(null)

    // Fetch the pre-captured screenshot (captured by Rust before this window opened)
    useEffect(() => {
        window.electron.ipcRenderer.invoke("get-picker-screenshot")
            .then(filePath => { if (filePath) setBgImage(convertFileSrc(filePath)) })
            .catch(e => console.warn("[AreaPicker] Screenshot failed:", e))
    }, [])

    const onCancel = () => window.electron.ipcRenderer.invoke("close-area-picker-window")

    const onSelect = () => window.electron.ipcRenderer.invoke("select-area", { ...areas[0], type: "area", name: "Area" })

    const customRender = areaProps => {
        if (!areaProps.isChanging) {
            return (<div key={areaProps.areaNumber}
                className="group w-full h-full flex items-center justify-center border-primary/50 bg-transparent border-4 hover:border-primary hover:bg-primary/10 transition-colors">
                <button onClick={onSelect}
                    className="btn btn-primary opacity-0 group-hover:opacity-100 transition-opacity shadow-lg" >
                    <CursorArrowRaysIcon className="h-6 w-6" />
                    Record area</button>
            </div>)
        }
    }

    return (<PickerWrapper onCancel={onCancel} >
        <AreaSelector areas={areas} maxAreas={1} minWidth={MIN_WIDTH} minHeight={MIN_HEIGHT}
            unit="percentage" onChange={setAreas}
            customAreaRenderer={customRender}>
            {bgImage
                ? <img src={bgImage} className="w-screen h-screen object-cover select-none" alt="" draggable={false} />
                : <div className="w-screen h-screen bg-base-300 flex items-center justify-center">
                    <span className="loading loading-spinner loading-lg"></span>
                </div>}
        </AreaSelector>
    </PickerWrapper>)
}
