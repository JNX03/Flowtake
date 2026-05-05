import { ChevronUpIcon, DevicePhoneMobileIcon, DeviceTabletIcon, TvIcon } from "@heroicons/react/16/solid"
import { useRef } from "react"
import { useDispatch, useSelector } from "react-redux"
import {
    selectAspectRatio,
    setAspectRatio
} from "@shared/redux/projectSlice"

export default function AspectRatioDropdown() {

    const dispatch = useDispatch()

    const aspectRatio = useSelector(selectAspectRatio)

    const aspectRatioButtonRef = useRef(null)

    const onClick = (e, aspectRatio) => {
        dispatch(setAspectRatio(aspectRatio))
        e.target.blur()
    }

    const buttonContent = aspectRatio => {
        switch (aspectRatio) {
            case "16x9": return <><div className="flex-1 flex items-center gap-2"><TvIcon className="w-4 h-4" />16:9</div><ChevronUpIcon className="w-4 h-4" /></>
            case "9x16": return <><div className="flex-1 flex items-center gap-2"><DevicePhoneMobileIcon className="w-4 h-4" />9:16</div><ChevronUpIcon className="w-4 h-4" /></>
            case "1x1": return <><div className="flex-1 flex items-center gap-2"><DeviceTabletIcon className="w-4 h-4" />Square</div><ChevronUpIcon className="w-4 h-4" /></>
        }
    }

    const menuItemContent = aspectRatio => {
        switch (aspectRatio) {
            case "16x9": return <><TvIcon className="w-4 h-4" />16:9</>
            case "9x16": return <><DevicePhoneMobileIcon className="w-4 h-4" />9:16</>
            case "1x1": return <><DeviceTabletIcon className="w-4 h-4" />Square</>
        }
    }

    return (<div className="dropdown dropdown-bottom dropdown-center">
        <button ref={aspectRatioButtonRef} type="button" className="btn btn-sm w-28">
            {buttonContent(aspectRatio)}
        </button>
        <ul tabIndex={0} className="dropdown-content menu menu-sm bg-base-100 text-base-content rounded-lg z-50 w-28 shadow-xl border border-base-content/10">
            <li><button onClick={e => onClick(e, "16x9")}>{menuItemContent("16x9")}</button></li>
            <li><button onClick={e => onClick(e, "9x16")}>{menuItemContent("9x16")}</button></li>
            <li><button onClick={e => onClick(e, "1x1")}>{menuItemContent("1x1")}</button></li>
        </ul>
    </div>)
}
