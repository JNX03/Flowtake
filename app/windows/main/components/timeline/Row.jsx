import PropTypes from "prop-types"
import {
    useCallback,
    useRef
} from "react"
import {
    useDispatch,
    useSelector
} from "react-redux"
import {
    MASKS,
    pxToMs
} from "@shared/helpers"
import {
    setPosition,
    setTime,
} from "@shared/redux/contextMenuSlice"
import {
    selectDuration,
    selectIsPlaying
} from "@shared/redux/editorSlice"
import {
    selectPxPerMs,
    selectSelectedRow,
    setSelectedIds,
    setSelectedRow
} from "@shared/redux/timelineSlice"

export default function Row({ className, animIds, onDoubleClick, onContextMenu, action: Action, isMinimized = false, isActive = null, name }) {

    const dispatch = useDispatch()

    const row = useRef(null)

    const duration = useSelector(selectDuration)
    const isPlaying = useSelector(selectIsPlaying)
    const selectedRow = useSelector(selectSelectedRow)
    const pxPerMs = useSelector(selectPxPerMs)

    const action = animId => <Action key={animId} id={animId} />

    const getMouseEventTime = useCallback(e => pxToMs(e.nativeEvent.offsetX, pxPerMs), [pxPerMs])

    const click = useCallback(e => {
        dispatch(setSelectedRow(name))
        if (e.target === row.current) dispatch(setSelectedIds([]))
    }, [dispatch, name])

    const doubleClick = useCallback(e => {
        if (e.target === row.current && onDoubleClick && !isMinimized) onDoubleClick(getMouseEventTime(e))
    }, [onDoubleClick, isMinimized, getMouseEventTime])

    const contextMenu = useCallback(e => {
        if (e.target === row.current && onContextMenu && !isPlaying && !isMinimized) {
            dispatch(setSelectedIds([]))
            dispatch(setPosition({ x: e.clientX, y: e.clientY }))
            dispatch(setTime(getMouseEventTime(e)))
            onContextMenu()
        }
    }, [onContextMenu, isPlaying, isMinimized, dispatch, getMouseEventTime])

    const isRowActive = isActive ?? selectedRow === name
    const bg = () => name === MASKS
        ? ""
        : `bg-linear-to-t from-transparent via-5% to-transparent ${isRowActive ? "via-primary/10 to-80% hover:to-90%" : `via-transparent ${isMinimized ? "" : "hover:via-base-content/10"} to-50%`}`

    return (duration && <div ref={row} onClick={click} onDoubleClick={doubleClick} onContextMenu={contextMenu}
        className={`${isMinimized ? "h-2" : className} relative shrink-0 ${bg()}`}>
        {animIds.map(action)}
    </div>)
}

Row.propTypes = {
    className: PropTypes.string,
    animIds: PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.string, PropTypes.number])).isRequired,
    onDoubleClick: PropTypes.func,
    onContextMenu: PropTypes.func,
    action: PropTypes.elementType.isRequired,
    name: PropTypes.string,
    isMinimized: PropTypes.bool,
    isActive: PropTypes.bool,
}
