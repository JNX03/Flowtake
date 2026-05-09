import { useCallback } from "react"
import { useDispatch, useSelector } from "react-redux"
import { APP_SCENES } from "@shared/helpers"
import { setIsNewAppSceneMenuOpen } from "@shared/redux/contextMenuSlice"
import { selectAppSceneIds } from "@shared/redux/appSceneAnimSlice"
import { selectIsMaskingModeEnabled } from "@shared/redux/timelineSlice"
import AppScene from "./AppScene"
import Row from "./Row"

export default function AppScenes() {
    const dispatch = useDispatch()
    const ids = useSelector(selectAppSceneIds)
    const isMinimized = useSelector(selectIsMaskingModeEnabled)

    const onContextMenu = useCallback(
        () => dispatch(setIsNewAppSceneMenuOpen(true)),
        [dispatch]
    )

    return (
        <Row name={APP_SCENES} className="h-12" animIds={ids} action={AppScene}
            onContextMenu={onContextMenu} isMinimized={isMinimized} />
    )
}
