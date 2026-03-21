import { useCallback } from "react"
import { useHotkeys } from "react-hotkeys-hook"
import {
    useDispatch,
    useSelector
} from "react-redux"
import {
    createSubtitle,
    SUBTITLES
} from "@shared/helpers"
import { setIsNewSubtitleMenuOpen } from "@shared/redux/contextMenuSlice"
import {
    selectAreHotkeysEnabled,
    selectDuration,
    selectIsPlaying
} from "@shared/redux/editorSlice"
import {
    selectAllSubtitles,
    selectSubtitleIds
} from "@shared/redux/subtitleSlice"
import {
    selectIsMaskingModeEnabled,
    selectSelectedRow,
    setOpenSection,
    setSelectedIds
} from "@shared/redux/timelineSlice"
import Row from "./Row"
import Subtitle from "./Subtitle"

export default function Subtitles() {

    const dispatch = useDispatch()

    const subtitleAnimIds = useSelector(selectSubtitleIds)
    const selectedRow = useSelector(selectSelectedRow)
    const areHotkeysEnabled = useSelector(selectAreHotkeysEnabled)
    const isPlaying = useSelector(selectIsPlaying)
    const isMinimized = useSelector(selectIsMaskingModeEnabled)
    const duration = useSelector(selectDuration)
    const subtitles = useSelector(selectAllSubtitles)

    useHotkeys(
        'ctrl+a',
        e => {
            e.preventDefault()
            dispatch(setSelectedIds(subtitleAnimIds))
            dispatch(setOpenSection(SUBTITLES))
        },
        { enabled: areHotkeysEnabled && selectedRow === SUBTITLES && !isPlaying && !isMinimized },
        [selectedRow, areHotkeysEnabled, isPlaying, isMinimized])

    const onDoubleClick = useCallback(
        time => dispatch(createSubtitle(time, subtitles, duration)),
        [dispatch, subtitles, duration]
    )

    const onContextMenu = useCallback(
        () => dispatch(setIsNewSubtitleMenuOpen(true)),
        [dispatch]
    )

    return (<Row name={SUBTITLES} className="h-12" animIds={subtitleAnimIds} action={Subtitle} onDoubleClick={onDoubleClick}
        onContextMenu={onContextMenu} isMinimized={isMinimized} />)
}