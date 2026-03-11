import { useCallback } from "react"
import { useHotkeys } from "react-hotkeys-hook"
import {
    useDispatch,
    useSelector
} from "react-redux"
import {
    createZoom,
    ZOOMS
} from "../../../../src/helpers"
import { selectTargetScale as selectCameraZoomTargetScale } from "../../../../src/redux/cameraZoomSlice"
import { setIsNewZoomMenuOpen } from "../../../../src/redux/contextMenuSlice"
import {
    selectAreHotkeysEnabled,
    selectDuration,
    selectIsPlaying
} from "../../../../src/redux/editorSlice"
import {
    selectIsMaskingModeEnabled,
    selectSelectedRow,
    setOpenSection,
    setSelectedIds
} from "../../../../src/redux/timelineSlice"
import {
    selectAllZooms,
    selectBlurStrength,
    selectIntro,
    selectOutro,
    selectZoomIds,
    selectTargetScale as selectZoomTargetScale
} from "../../../../src/redux/zoomSlice"
import Row from "./Row"
import Zoom from "./Zoom"

export default function Zooms() {

    const dispatch = useDispatch()

    const zoomAnimIds = useSelector(selectZoomIds)
    const selectedRow = useSelector(selectSelectedRow)
    const areHotkeysEnabled = useSelector(selectAreHotkeysEnabled)
    const isPlaying = useSelector(selectIsPlaying)
    const isMinimized = useSelector(selectIsMaskingModeEnabled)
    const duration = useSelector(selectDuration)
    const zooms = useSelector(selectAllZooms)
    const cameraZoomTargetScale = useSelector(selectCameraZoomTargetScale)
    const blurStrength = useSelector(selectBlurStrength)
    const intro = useSelector(selectIntro)
    const outro = useSelector(selectOutro)
    const zoomTargetScale = useSelector(selectZoomTargetScale)

    useHotkeys(
        'ctrl+a',
        e => {
            e.preventDefault()
            dispatch(setSelectedIds(zoomAnimIds))
            dispatch(setOpenSection(ZOOMS))
        },
        { enabled: areHotkeysEnabled && selectedRow === ZOOMS && !isPlaying && !isMinimized },
        [selectedRow, areHotkeysEnabled, isPlaying, isMinimized])

    const onDoubleClick = useCallback(time => {
        const actions = createZoom(time, zooms, duration, cameraZoomTargetScale, blurStrength, intro, outro,
            zoomTargetScale)
        actions.forEach(action => dispatch(action))
    }, [dispatch, zooms, duration, cameraZoomTargetScale, blurStrength, intro, outro, zoomTargetScale])

    const onContextMenu = useCallback(
        () => dispatch(setIsNewZoomMenuOpen(true)),
        [dispatch]
    )

    return (<Row name={ZOOMS} className="h-12" animIds={zoomAnimIds} action={Zoom} onDoubleClick={onDoubleClick}
        onContextMenu={onContextMenu} isMinimized={isMinimized} />)
}