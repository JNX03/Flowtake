import { useSelector } from "react-redux"
import TitleBar from "../../../components/TitleBar"
import { selectLoaderMessage } from "../../../src/redux/appSlice"

export default function Loader() {

    const loaderMessage = useSelector(selectLoaderMessage)

    return (<>
        {loaderMessage && <>
            <div className="h-full w-full absolute top-0 z-60 bg-base-300 flex flex-col items-center justify-center gap-5">
                <TitleBar overlayButtons={3} />
                <span className="loading loading-spinner loading-lg"></span>
                <p>{loaderMessage}</p>
            </div>
        </>}
    </>)
}

