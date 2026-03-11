import {
    AdjustmentsHorizontalIcon,
    ArrowsPointingOutIcon,
    ComputerDesktopIcon,
    CursorArrowRippleIcon,
    VideoCameraIcon
} from "@heroicons/react/16/solid"
import PropTypes from "prop-types"
import {
    useMemo
} from "react"
import {
    useDispatch,
    useSelector
} from "react-redux"
import {
    formatX,
    ZOOMS
} from "../../../../src/helpers"
import {
    getGroup,
    withGroup
} from "../../../../src/redux/actionEnhancers"
import {
    selectAllCameraZooms,
    updateCameraZoom
} from "../../../../src/redux/cameraZoomSlice"
import { setIsZoomMenuOpen } from "../../../../src/redux/contextMenuSlice"
import {
    selectAllPans,
    updatePan
} from "../../../../src/redux/panSlice"
import { selectHasCameraVideo } from "../../../../src/redux/projectSlice"
import {
    selectIsMaskingModeEnabled,
    selectSelectedRow,
    setOpenSection,
    setSelectedRow
} from "../../../../src/redux/timelineSlice"
import {
    selectAllZooms,
    selectZoomById,
    updateZoom
} from "../../../../src/redux/zoomSlice"
import FlexibleAction from "./FlexibleAction"
import Label from "./Label"

export default function Zoom({ id }) {

    const dispatch = useDispatch()

    const zoom = useSelector(state => selectZoomById(state, id))
    const zooms = useSelector(selectAllZooms)
    const pans = useSelector(selectAllPans)
    const cameraZooms = useSelector(selectAllCameraZooms)
    const hasCameraVideo = useSelector(selectHasCameraVideo)
    const selectedRow = useSelector(selectSelectedRow)
    const isMinimized = useSelector(selectIsMaskingModeEnabled)

    const pan = useMemo(
        () => pans.find(({ start, end }) => start === zoom?.start && end === zoom?.end),
        [zoom, pans])

    const cameraZoom = useMemo(
        () => cameraZooms.find(({ start, end }) => start === zoom?.start && end === zoom?.end),
        [zoom, cameraZooms])

    const onChange = (start, end) => {
        const group = getGroup("zoom-resize")
        dispatch(withGroup(updateZoom({ id: zoom.id, changes: { start, end } }), group))
        dispatch(withGroup(updatePan({ id: pan.id, changes: { start, end } }), group))
        dispatch(withGroup(updateCameraZoom({ id: cameraZoom.id, changes: { start, end } }), group))
    }

    const onSelect = () => {
        dispatch(setSelectedRow(ZOOMS))
        dispatch(setOpenSection(ZOOMS))
    }

    const onContextMenu = () => {
        dispatch(setSelectedRow(ZOOMS))
        dispatch(setOpenSection(ZOOMS))
        dispatch(setIsZoomMenuOpen(true))
    }

    return (<FlexibleAction anim={zoom} anims={zooms} isRowSelected={selectedRow === ZOOMS} onChange={onChange}
        onSelect={onSelect} onContextMenu={onContextMenu} color="secondary" isMinimized={isMinimized}>

        <Label
            isMinimized={isMinimized}
            line1={<><ArrowsPointingOutIcon className="size-4 shrink-0 mr-1" />Zoom</>}
            line2={<>
                <span className="flex items-center gap-1">
                    <ComputerDesktopIcon className="size-3 shrink-0" />{formatX(zoom.targetScale)}
                </span>
                {hasCameraVideo && <span className="flex items-center gap-1">
                    <VideoCameraIcon className="size-3 shrink-0" />{formatX(cameraZoom.targetScale)}
                </span>}
                <span className="flex items-center gap-1">
                    {pan?.isManual
                        ? <><AdjustmentsHorizontalIcon className="size-3 shrink-0" />Manual zoom</>
                        : <><CursorArrowRippleIcon className="size-3 shrink-0" />Follow cursor</>}
                </span>
            </>}
        />

    </FlexibleAction>)
}

Zoom.propTypes = {
    id: PropTypes.string.isRequired
}