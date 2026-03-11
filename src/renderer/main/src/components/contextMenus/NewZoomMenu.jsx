import { PlusIcon } from "@heroicons/react/16/solid"
import {
    useCallback,
    useMemo
} from "react"
import {
    useDispatch,
    useSelector
} from "react-redux"
import { createZoom } from "../../../../src/helpers"
import { selectTargetScale as selectCameraZoomTargetScale } from "../../../../src/redux/cameraZoomSlice"
import {
    selectIsNewZoomMenuOpen,
    selectTime,
    setIsNewZoomMenuOpen
} from "../../../../src/redux/contextMenuSlice"
import { selectDuration } from "../../../../src/redux/editorSlice"
import {
    selectAllZooms,
    selectBlurStrength,
    selectIntro,
    selectOutro,
    selectTargetScale as selectZoomTargetScale
} from "../../../../src/redux/zoomSlice"
import Item from "./Item"
import Menu from "./Menu"

export default function NewZoomMenu() {

    const dispatch = useDispatch()

    const isOpen = useSelector(selectIsNewZoomMenuOpen)
    const time = useSelector(selectTime)
    const duration = useSelector(selectDuration)
    const zooms = useSelector(selectAllZooms)
    const cameraZoomTargetScale = useSelector(selectCameraZoomTargetScale)
    const blurStrength = useSelector(selectBlurStrength)
    const intro = useSelector(selectIntro)
    const outro = useSelector(selectOutro)
    const zoomTargetScale = useSelector(selectZoomTargetScale)

    const isEnabled = useMemo(
        () => isOpen && duration && time !== null && time >= 0 && time <= duration,
        [isOpen, duration, time]
    )

    const onNew = useCallback(() => {
        dispatch(setIsNewZoomMenuOpen(false))
        const actions = createZoom(time, zooms, duration, cameraZoomTargetScale, blurStrength, intro, outro,
            zoomTargetScale)
        actions.forEach(action => dispatch(action))
    }, [dispatch, time, zooms, duration, cameraZoomTargetScale, blurStrength, intro, outro, zoomTargetScale])
    
    const close = useCallback(() => {
        dispatch(setIsNewZoomMenuOpen(false))
    }, [dispatch])

    return (
        <Menu isOpen={isOpen} close={close}>
            <Item text="New Zoom" icon={PlusIcon} isEnabled={isEnabled} onClick={onNew} />
        </Menu>
    )
}