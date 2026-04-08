import { useCallback } from "react"
import { useHotkeys } from "react-hotkeys-hook"
import {
    useDispatch,
    useSelector
} from "react-redux"
import {
    createSpatial,
    SPATIALS
} from "@shared/helpers"
import {
    selectAreHotkeysEnabled,
    selectDuration,
    selectIsPlaying
} from "@shared/redux/editorSlice"
import {
    selectAllSpatials,
    selectSpatialCameraDistance,
    selectSpatialEyeContactEnabled,
    selectSpatialIds,
    selectSpatialIntro,
    selectSpatialOutro,
    selectSpatialPerspective,
    selectSpatialRotateX,
    selectSpatialRotateY,
    selectSpatialRotateZ
} from "@shared/redux/spatialSlice"
import {
    selectIsMaskingModeEnabled,
    selectSelectedRow,
    setOpenSection,
    setSelectedIds
} from "@shared/redux/timelineSlice"
import Row from "./Row"
import SpatialClip from "./SpatialClip"

export default function SpatialClips() {

    const dispatch = useDispatch()

    const spatialAnimIds = useSelector(selectSpatialIds)
    const selectedRow = useSelector(selectSelectedRow)
    const areHotkeysEnabled = useSelector(selectAreHotkeysEnabled)
    const isPlaying = useSelector(selectIsPlaying)
    const isMinimized = useSelector(selectIsMaskingModeEnabled)
    const duration = useSelector(selectDuration)
    const spatials = useSelector(selectAllSpatials)
    const rotateX = useSelector(selectSpatialRotateX)
    const rotateY = useSelector(selectSpatialRotateY)
    const rotateZ = useSelector(selectSpatialRotateZ)
    const perspective = useSelector(selectSpatialPerspective)
    const cameraDistance = useSelector(selectSpatialCameraDistance)
    const eyeContactEnabled = useSelector(selectSpatialEyeContactEnabled)
    const intro = useSelector(selectSpatialIntro)
    const outro = useSelector(selectSpatialOutro)

    useHotkeys(
        'ctrl+a',
        e => {
            e.preventDefault()
            dispatch(setSelectedIds(spatialAnimIds))
            dispatch(setOpenSection(SPATIALS))
        },
        { enabled: areHotkeysEnabled && selectedRow === SPATIALS && !isPlaying && !isMinimized },
        [selectedRow, areHotkeysEnabled, isPlaying, isMinimized])

    const onDoubleClick = useCallback(time => {
        dispatch(createSpatial(time, spatials, duration, rotateX, rotateY, rotateZ,
            perspective, cameraDistance, eyeContactEnabled, intro, outro))
    }, [dispatch, spatials, duration, rotateX, rotateY, rotateZ, perspective, cameraDistance, eyeContactEnabled, intro, outro])

    return (<Row name={SPATIALS} className="h-12" animIds={spatialAnimIds} action={SpatialClip}
        onDoubleClick={onDoubleClick} isMinimized={isMinimized} />)
}
