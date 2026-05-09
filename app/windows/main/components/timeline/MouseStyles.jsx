import { useCallback } from "react"
import { useDispatch, useSelector } from "react-redux"
import { MOUSE_STYLES } from "@shared/helpers"
import { setIsNewMouseStyleMenuOpen } from "@shared/redux/contextMenuSlice"
import { selectMouseStyleIds } from "@shared/redux/mouseStyleAnimSlice"
import { selectIsMaskingModeEnabled } from "@shared/redux/timelineSlice"
import MouseStyle from "./MouseStyle"
import Row from "./Row"

export default function MouseStyles() {
    const dispatch = useDispatch()
    const ids = useSelector(selectMouseStyleIds)
    const isMinimized = useSelector(selectIsMaskingModeEnabled)

    const onContextMenu = useCallback(
        () => dispatch(setIsNewMouseStyleMenuOpen(true)),
        [dispatch]
    )

    return (
        <Row name={MOUSE_STYLES} className="h-12" animIds={ids} action={MouseStyle}
            onContextMenu={onContextMenu} isMinimized={isMinimized} />
    )
}
