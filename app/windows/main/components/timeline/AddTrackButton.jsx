import {
    MusicalNoteIcon,
    PlusIcon,
    Square2StackIcon
} from "@heroicons/react/16/solid"
import { useCallback, useRef, useState } from "react"
import { useDispatch } from "react-redux"
import { addTrack as addAudioTrack } from "@shared/redux/audioTrackSlice"
import { addOverlayTrack } from "@shared/redux/overlaySlice"

export default function AddTrackButton() {

    const dispatch = useDispatch()
    const [isOpen, setIsOpen] = useState(false)
    const menuRef = useRef(null)

    const handleAddAudioTrack = useCallback(() => {
        dispatch(addAudioTrack())
        setIsOpen(false)
    }, [dispatch])

    const handleAddOverlayTrack = useCallback(() => {
        dispatch(addOverlayTrack())
        setIsOpen(false)
    }, [dispatch])

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                title="Add a new audio or overlay track"
                className="btn btn-sm btn-ghost gap-1.5 w-full justify-start border border-dashed border-base-content/20 hover:border-base-content/60 hover:bg-base-content/5"
            >
                <PlusIcon className="size-4" />
                <span className="text-xs font-medium">Add Track</span>
            </button>
            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                    <div ref={menuRef}
                        className="absolute bottom-full left-0 mb-1 bg-base-200 rounded-lg shadow-xl border border-base-content/10 z-50 overflow-hidden min-w-44"
                    >
                        <button
                            onClick={handleAddAudioTrack}
                            className="flex items-center gap-2.5 px-3 py-2.5 text-sm w-full hover:bg-base-content/10 transition-colors"
                        >
                            <MusicalNoteIcon className="size-4 text-secondary" />
                            Audio Track
                        </button>
                        <button
                            onClick={handleAddOverlayTrack}
                            className="flex items-center gap-2.5 px-3 py-2.5 text-sm w-full hover:bg-base-content/10 transition-colors"
                        >
                            <Square2StackIcon className="size-4 text-accent" />
                            Overlay Track
                        </button>
                    </div>
                </>
            )}
        </div>
    )
}
