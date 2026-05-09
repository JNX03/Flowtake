import { CursorArrowRaysIcon } from "@heroicons/react/16/solid"
import PropTypes from "prop-types"
import { useCallback } from "react"
import { useDispatch, useSelector } from "react-redux"
import { MOUSE_STYLES } from "@shared/helpers"
import {
    setIsMouseStyleMenuOpen,
    setMouseStyleId
} from "@shared/redux/contextMenuSlice"
import {
    selectAllMouseStyles,
    selectMouseStyleById,
    selectMouseStyleDefaults,
    updateMouseStyle
} from "@shared/redux/mouseStyleAnimSlice"
import {
    selectIsMaskingModeEnabled,
    selectSelectedRow,
    setOpenSection,
    setSelectedRow
} from "@shared/redux/timelineSlice"
import FlexibleAction from "./FlexibleAction"
import Label from "./Label"

export default function MouseStyle({ id }) {
    const dispatch = useDispatch()

    const anim = useSelector(state => selectMouseStyleById(state, id))
    const anims = useSelector(selectAllMouseStyles)
    const defaults = useSelector(selectMouseStyleDefaults)
    const selectedRow = useSelector(selectSelectedRow)
    const isMinimized = useSelector(selectIsMaskingModeEnabled)

    const onChange = useCallback(
        (start, end) => dispatch(updateMouseStyle({ id, changes: { start, end } })),
        [dispatch, id]
    )

    const onSelect = useCallback(() => {
        dispatch(setSelectedRow(MOUSE_STYLES))
        dispatch(setOpenSection(MOUSE_STYLES))
    }, [dispatch])

    const onContextMenu = useCallback(() => {
        dispatch(setSelectedRow(MOUSE_STYLES))
        dispatch(setOpenSection(MOUSE_STYLES))
        dispatch(setMouseStyleId(id))
        dispatch(setIsMouseStyleMenuOpen(true))
    }, [dispatch, id])

    if (!anim) return null

    const color = anim.color ?? defaults.color
    const label = anim.label ?? defaults.label

    return (
        <FlexibleAction anim={anim} anims={anims} isRowSelected={selectedRow === MOUSE_STYLES}
            onChange={onChange} onSelect={onSelect} onContextMenu={onContextMenu}
            color="primary" isMinimized={isMinimized}>
            <Label
                isMinimized={isMinimized}
                line1={<><CursorArrowRaysIcon className="size-4 shrink-0 mr-1" />Cursor</>}
                line2={<>
                    <span className="inline-block size-2.5 rounded-full mr-1" style={{ backgroundColor: color }} />
                    <span className="opacity-70 truncate">{label || "(no tag)"}</span>
                </>}
            />
        </FlexibleAction>
    )
}

MouseStyle.propTypes = {
    id: PropTypes.string.isRequired,
}
