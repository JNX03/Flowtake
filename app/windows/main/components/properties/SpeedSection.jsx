import { useCallback } from "react"
import {
    useDispatch,
    useSelector
} from "react-redux"
import {
    selectClipById,
    updateClip
} from "@shared/redux/clipSlice"
import { selectSelectedIds } from "@shared/redux/timelineSlice"

const SPEED_PRESETS = [
    { label: "0.25x", value: 0.25 },
    { label: "0.5x", value: 0.5 },
    { label: "1x", value: 1 },
    { label: "1.5x", value: 1.5 },
    { label: "2x", value: 2 },
    { label: "4x", value: 4 },
]

export default function SpeedSection() {
    const dispatch = useDispatch()
    const selectedIds = useSelector(selectSelectedIds)
    const clipId = selectedIds[0]
    const clip = useSelector(state => clipId ? selectClipById(state, clipId) : null)

    const speed = clip?.playbackRate ?? 1

    const setSpeed = useCallback(value => {
        if (!clipId) return
        dispatch(updateClip({ id: clipId, changes: { playbackRate: value } }))
    }, [dispatch, clipId])

    if (!clip) return null

    return (
        <div className="flex flex-col gap-2">
            <div className="grid grid-cols-6 gap-1">
                {SPEED_PRESETS.map(preset => (
                    <button key={preset.value}
                        onClick={() => setSpeed(preset.value)}
                        className={`py-1.5 rounded text-[10px] font-medium transition-colors ${
                            speed === preset.value
                                ? "bg-primary text-primary-content"
                                : "bg-base-200 text-base-content/60 hover:text-base-content"
                        }`}>
                        {preset.label}
                    </button>
                ))}
            </div>
            <div className="flex items-center gap-2">
                <span className="text-[10px] opacity-50 w-12">Speed</span>
                <input type="range" min="0.25" max="16" step="0.25"
                    value={speed}
                    onChange={e => setSpeed(Number(e.target.value))}
                    className="range range-xs range-primary flex-1" />
                <span className="text-[10px] opacity-50 w-10 text-right font-mono">{speed}x</span>
            </div>
        </div>
    )
}
