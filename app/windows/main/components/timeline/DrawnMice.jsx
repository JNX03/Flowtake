import { useCallback } from "react"
import { useDispatch, useSelector } from "react-redux"
import { DRAWN_MICE } from "@shared/helpers"
import { setIsNewDrawnMouseMenuOpen } from "@shared/redux/contextMenuSlice"
import { selectDrawnMouseIds } from "@shared/redux/drawnMouseAnimSlice"
import { selectIsMaskingModeEnabled } from "@shared/redux/timelineSlice"
import DrawnMouse from "./DrawnMouse"
import Row from "./Row"

export default function DrawnMice() {
    const dispatch = useDispatch()
    const ids = useSelector(selectDrawnMouseIds)
    const isMinimized = useSelector(selectIsMaskingModeEnabled)

    const onContextMenu = useCallback(
        () => dispatch(setIsNewDrawnMouseMenuOpen(true)),
        [dispatch]
    )

    return (
        <Row name={DRAWN_MICE} className="h-12" animIds={ids} action={DrawnMouse}
            onContextMenu={onContextMenu} isMinimized={isMinimized} />
    )
}
