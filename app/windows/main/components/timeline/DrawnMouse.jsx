import { PencilSquareIcon } from "@heroicons/react/16/solid"
import PropTypes from "prop-types"
import { useCallback } from "react"
import { useDispatch, useSelector } from "react-redux"
import { DRAWN_MICE } from "@shared/helpers"
import {
    setDrawnMouseId,
    setIsDrawnMouseMenuOpen
} from "@shared/redux/contextMenuSlice"
import {
    selectAllDrawnMice,
    selectDrawnMouseById,
    selectDrawnMouseDefaults,
    updateDrawnMouse
} from "@shared/redux/drawnMouseAnimSlice"
import {
    selectIsMaskingModeEnabled,
    selectSelectedRow,
    setOpenSection,
    setSelectedRow
} from "@shared/redux/timelineSlice"
import FlexibleAction from "./FlexibleAction"
import Label from "./Label"

export default function DrawnMouse({ id }) {
    const dispatch = useDispatch()

    const anim = useSelector(state => selectDrawnMouseById(state, id))
    const anims = useSelector(selectAllDrawnMice)
    const defaults = useSelector(selectDrawnMouseDefaults)
    const selectedRow = useSelector(selectSelectedRow)
    const isMinimized = useSelector(selectIsMaskingModeEnabled)

    const onChange = useCallback(
        (start, end) => dispatch(updateDrawnMouse({ id, changes: { start, end } })),
        [dispatch, id]
    )

    const onSelect = useCallback(() => {
        dispatch(setSelectedRow(DRAWN_MICE))
        dispatch(setOpenSection(DRAWN_MICE))
    }, [dispatch])

    const onContextMenu = useCallback(() => {
        dispatch(setSelectedRow(DRAWN_MICE))
        dispatch(setOpenSection(DRAWN_MICE))
        dispatch(setDrawnMouseId(id))
        dispatch(setIsDrawnMouseMenuOpen(true))
    }, [dispatch, id])

    if (!anim) return null

    const color = anim.color ?? defaults.color
    const label = anim.label ?? defaults.label

    return (
        <FlexibleAction anim={anim} anims={anims} isRowSelected={selectedRow === DRAWN_MICE}
            onChange={onChange} onSelect={onSelect} onContextMenu={onContextMenu}
            color="accent" isMinimized={isMinimized}>
            <Label
                isMinimized={isMinimized}
                line1={<><PencilSquareIcon className="size-4 shrink-0 mr-1" />Drawn</>}
                line2={<>
                    <span className="inline-block size-2.5 rounded-full mr-1" style={{ backgroundColor: color }} />
                    <span className="opacity-70 truncate">{label || "(no tag)"}</span>
                </>}
            />
        </FlexibleAction>
    )
}

DrawnMouse.propTypes = {
    id: PropTypes.string.isRequired,
}
