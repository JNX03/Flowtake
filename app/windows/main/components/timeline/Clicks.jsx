import { useHotkeys } from "react-hotkeys-hook"
import {
    useDispatch,
    useSelector
} from "react-redux"
import { CLICKS } from "@shared/helpers"
import { selectClickIds } from "@shared/redux/clickSlice"
import {
    selectAreHotkeysEnabled,
    selectIsPlaying
} from "@shared/redux/editorSlice"
import {
    selectIsMaskingModeEnabled,
    selectSelectedRow,
    setOpenSection,
    setSelectedIds
} from "@shared/redux/timelineSlice"
import Click from "./Click"
import Row from "./Row"

export default function Clicks() {

    const dispatch = useDispatch()

    const clickAnimIds = useSelector(selectClickIds)
    const selectedRow = useSelector(selectSelectedRow)
    const areHotkeysEnabled = useSelector(selectAreHotkeysEnabled)
    const isPlaying = useSelector(selectIsPlaying)
    const isMinimized = useSelector(selectIsMaskingModeEnabled)

    useHotkeys(
        'ctrl+a',
        e => {
            e.preventDefault()
            dispatch(setSelectedIds(clickAnimIds))
            dispatch(setOpenSection(CLICKS))
        },
        { enabled: areHotkeysEnabled && selectedRow === CLICKS && !isPlaying && !isMinimized },
        [selectedRow, areHotkeysEnabled, isPlaying, isMinimized])

    return (<Row name={CLICKS} className="h-4" animIds={clickAnimIds} action={Click} isMinimized={isMinimized} />)
}

