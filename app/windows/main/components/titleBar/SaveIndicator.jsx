import { CheckIcon } from "@heroicons/react/16/solid"
import {
    useEffect,
    useRef,
    useState
} from "react"
import { useSelector } from "react-redux"
import { selectIsSaving } from "@shared/redux/editorSlice"

export default function SaveIndicator() {
    const isSaving = useSelector(selectIsSaving)
    const [showCheckmark, setShowCheckmark] = useState(false)
    const timeoutRef = useRef(null)
    const prevIsSavingRef = useRef(isSaving)

    useEffect(() => {
        const wasSaving = prevIsSavingRef.current
        prevIsSavingRef.current = isSaving

        if (wasSaving && !isSaving) {
            // Save just completed - schedule checkmark display
            if (timeoutRef.current) clearTimeout(timeoutRef.current)
            
            // Use queueMicrotask to defer state update (React 18+ recommended pattern)
            queueMicrotask(() => {
                setShowCheckmark(true)
                timeoutRef.current = setTimeout(() => {
                    setShowCheckmark(false)
                }, 1000)
            })
        } else if (isSaving && showCheckmark) {
            // Save started while checkmark showing - hide it
            queueMicrotask(() => {
                setShowCheckmark(false)
                if (timeoutRef.current) {
                    clearTimeout(timeoutRef.current)
                    timeoutRef.current = null
                }
            })
        }
    }, [isSaving, showCheckmark])

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current)
        }
    }, [])

    return (<label className={"mt-1 cursor-default swap swap-flip " +
        `${showCheckmark ? "swap-active" : ""} ${isSaving || showCheckmark ? "" : "hidden"}`}>
        <CheckIcon className="swap-on size-4 text-success" />
        <span className="swap-off loading loading-spinner loading-xs text-base-content/70" />
    </label>)
}