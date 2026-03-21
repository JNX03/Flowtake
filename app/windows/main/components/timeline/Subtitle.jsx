import { ChatBubbleOvalLeftIcon } from "@heroicons/react/16/solid"
import PropTypes from "prop-types"
import { useCallback } from "react"
import {
    useDispatch,
    useSelector
} from "react-redux"
import { SUBTITLES } from "@shared/helpers"
import { setIsSubtitleMenuOpen } from "@shared/redux/contextMenuSlice"
import {
    selectAllSubtitles,
    selectSubtitleById,
    updateSubtitle
} from "@shared/redux/subtitleSlice"
import {
    selectIsMaskingModeEnabled,
    selectSelectedRow,
    setOpenSection,
    setSelectedRow
} from "@shared/redux/timelineSlice"
import FlexibleAction from "./FlexibleAction"
import Label from "./Label"

export default function Subtitle({ id }) {

    const dispatch = useDispatch()

    const anim = useSelector(state => selectSubtitleById(state, id))
    const anims = useSelector(state => selectAllSubtitles(state, id))
    const selectedRow = useSelector(selectSelectedRow)
    const isMinimized = useSelector(selectIsMaskingModeEnabled)

    const onChange = useCallback(
        (start, end) => dispatch(updateSubtitle({ id, changes: { start, end } })),
        [dispatch, id]
    )

    const onSelect = useCallback(() => {
        dispatch(setSelectedRow(SUBTITLES))
        dispatch(setOpenSection(SUBTITLES))
    }, [dispatch])

    const onContextMenu = useCallback(() => {
        dispatch(setSelectedRow(SUBTITLES))
        dispatch(setOpenSection(SUBTITLES))
        dispatch(setIsSubtitleMenuOpen(true))
    }, [dispatch])

    return (<FlexibleAction anim={anim} anims={anims} isRowSelected={selectedRow === SUBTITLES} onChange={onChange}
        onSelect={onSelect} onContextMenu={onContextMenu} color="tertiary" isMinimized={isMinimized}>

        <Label
            isMinimized={isMinimized}
            line1={anim.text}
            line2={<span className="flex items-center gap-1">
                <ChatBubbleOvalLeftIcon className="size-4 shrink-0" />Subtitle
            </span>}
        />

    </FlexibleAction>)
}

Subtitle.propTypes = {
    id: PropTypes.string.isRequired
}