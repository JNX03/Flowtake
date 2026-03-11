import PropTypes from "prop-types"
import {
    useCallback,
    useRef,
    useState
} from "react"
import { useResizeDetector } from "react-resize-detector"
import { getGroup } from "../../../../src/redux/actionEnhancers"

export default function CoordPicker({ coords, onChange, disabled }) {

    const [isMouseDown, setIsMouseDown] = useState(false)
    const [isMouseMoving, setIsMouseMoving] = useState(false)
    const [group, setGroup] = useState(getGroup("coord-picker"))

    const handleRef = useRef(null)

    const { width, height, ref } = useResizeDetector()

    const getCoords = useCallback(event => {
        if (!width || !height) return { x: 0, y: 0 }
        return { x: event.nativeEvent.offsetX / width, y: event.nativeEvent.offsetY / height }
    }, [width, height])

    const onMouseDown = useCallback(() => {
        if (disabled) return
        setIsMouseDown(true)
    }, [disabled])

    const onMouseUp = useCallback(event => {
        setIsMouseMoving(false)
        setIsMouseDown(false)
        onChange?.(getCoords(event), group)
        setGroup(getGroup("coord-picker"))
    }, [getCoords, group, onChange])

    const onMouseMove = useCallback(event => {
        if (isMouseDown) {
            setIsMouseMoving(true)
            onChange?.(getCoords(event), group)
        }
    }, [isMouseDown, onChange, getCoords, group])

    return (
        <div className="w-full flex justify-center mt-2">
            <div className="aspect-square w-1/2 bg-base-300 relative rounded-lg overflow-hidden shadow-lg group"
                onMouseDown={onMouseDown} onMouseUp={onMouseUp} onMouseMove={onMouseMove} ref={ref}>
                <div className={"w-0 h-0 absolute pointer-events-none left-0 top-0" +
                    ` ${isMouseMoving ? "" : "transition-transform"}`}
                    style={{ transform: `translate(${coords.x * width}px, ${coords.y * height}px)` }}
                    ref={handleRef}>
                    <div className={"w-6 h-6 -translate-x-3 -translate-y-3 bg-base-content group-hover:bg-info " +
                        `rounded-full shadow-lg group-hover:scale-125 transition-all ${!coords && "opacity-0"}`} />
                </div>
            </div>
        </div>
    )
}

CoordPicker.propTypes = {
    coords: PropTypes.shape({
        x: PropTypes.number,
        y: PropTypes.number
    }),
    onChange: PropTypes.func,
    disabled: PropTypes.bool
}