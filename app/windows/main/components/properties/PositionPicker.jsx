import { UserIcon } from "@heroicons/react/20/solid"
import { ComputerDesktopIcon } from "@heroicons/react/24/outline"
import PropTypes from "prop-types"
import {
    useCallback,
    useRef,
    useState
} from "react"
import { useResizeDetector } from "react-resize-detector"
import {
    shallowEqual,
    useSelector
} from "react-redux"
import {
    POS_BOTTOM_LEFT,
    POS_BOTTOM_RIGHT,
    POS_TOP_LEFT,
    POS_TOP_RIGHT
} from "@shared/constants"
import { getGroup } from "@shared/redux/actionEnhancers"
import { selectAspectRatio } from "@shared/redux/projectSlice"

const CORNERS = [
    { pos: POS_TOP_LEFT, style: "top-1 left-1", label: "Top left" },
    { pos: POS_TOP_RIGHT, style: "top-1 right-1", label: "Top right" },
    { pos: POS_BOTTOM_LEFT, style: "bottom-1 left-1", label: "Bottom left" },
    { pos: POS_BOTTOM_RIGHT, style: "bottom-1 right-1", label: "Bottom right" },
]

export default function PositionPicker({ coords, onChange, disabled = false }) {

    const aspectRatio = useSelector(selectAspectRatio)
    const { width, height, ref } = useResizeDetector()

    const [isDragging, setIsDragging] = useState(false)
    const [group, setGroup] = useState(() => getGroup("position-picker"))
    const frameRef = useRef(null)

    const getNormalized = useCallback(event => {
        if (!frameRef.current || !width || !height) return null
        const rect = frameRef.current.getBoundingClientRect()
        const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width))
        const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))
        return { x, y }
    }, [width, height])

    const aspectClass = () => {
        switch (aspectRatio) {
            case "16x9": return "aspect-video"
            case "9x16": return "aspect-9/16"
            case "1x1": return "aspect-square"
            default: return "aspect-video"
        }
    }

    const isCorner = CORNERS.some(c => shallowEqual(c.pos, coords))

    const onPointerDown = useCallback(event => {
        if (disabled) return
        event.preventDefault()
        const c = getNormalized(event)
        if (!c) return
        setIsDragging(true)
        onChange?.(c, group)
        event.currentTarget.setPointerCapture?.(event.pointerId)
    }, [disabled, getNormalized, onChange, group])

    const onPointerMove = useCallback(event => {
        if (!isDragging || disabled) return
        const c = getNormalized(event)
        if (!c) return
        onChange?.(c, group)
    }, [isDragging, disabled, getNormalized, onChange, group])

    const onPointerUp = useCallback(event => {
        if (!isDragging) return
        setIsDragging(false)
        setGroup(getGroup("position-picker"))
        try { event.currentTarget.releasePointerCapture?.(event.pointerId) } catch { /* ignore */ }
    }, [isDragging])

    const onCornerClick = useCallback((event, pos) => {
        event.stopPropagation()
        if (disabled) return
        onChange?.(pos, getGroup("position-picker"))
        setGroup(getGroup("position-picker"))
    }, [disabled, onChange])

    return (
        <div className="w-full flex justify-center">
            <div className={`relative ${aspectClass()} max-w-[72%] w-full`} ref={ref}>
                <div
                    ref={frameRef}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerCancel={onPointerUp}
                    className={`absolute inset-0 rounded-lg border bg-base-300/50 overflow-hidden
                        ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-crosshair border-base-content/10 hover:border-base-content/20"}
                        transition-colors`}
                >
                    <div className="absolute inset-2 rounded border border-base-content/15 bg-base-200/40 flex items-center justify-center pointer-events-none">
                        <ComputerDesktopIcon className="w-5 h-5 text-base-content/30" />
                    </div>

                    {CORNERS.map(({ pos, style, label }) => {
                        const active = shallowEqual(coords, pos)
                        return (
                            <button
                                key={label}
                                type="button"
                                aria-label={label}
                                onPointerDown={e => e.stopPropagation()}
                                onClick={e => onCornerClick(e, pos)}
                                className={`absolute ${style} w-4 h-4 rounded-sm border transition-all
                                    ${active
                                        ? "bg-info border-info-content"
                                        : "bg-base-200/60 border-base-content/30 hover:bg-info/40 hover:border-info"}`}
                            />
                        )
                    })}

                    {coords && width != null && height != null && (
                        <div
                            className={`absolute w-6 h-6 -ml-3 -mt-3 rounded-full border-2 flex items-center justify-center shadow-lg pointer-events-none
                                ${isDragging ? "" : "transition-[left,top] duration-150"}
                                ${isCorner ? "bg-info border-info-content" : "bg-info/90 border-info-content ring-2 ring-info/30"}`}
                            style={{ left: `${coords.x * 100}%`, top: `${coords.y * 100}%` }}
                        >
                            <UserIcon className="w-3 h-3 text-info-content" />
                        </div>
                    )}
                </div>

                <p className="mt-2 text-[10px] text-center text-base-content/50">
                    {isCorner ? "Snap to a corner, or drag anywhere to place freely" : "Custom position — click a corner to snap"}
                </p>
            </div>
        </div>
    )
}

PositionPicker.propTypes = {
    coords: PropTypes.shape({
        x: PropTypes.number.isRequired,
        y: PropTypes.number.isRequired,
    }),
    onChange: PropTypes.func,
    disabled: PropTypes.bool,
}
