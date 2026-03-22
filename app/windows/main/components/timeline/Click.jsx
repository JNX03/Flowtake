import PropTypes from "prop-types"
import {
    useMemo
} from "react"
import {
    useDispatch,
    useSelector
} from "react-redux"
import { CLICKS } from "@shared/helpers"
import {
    selectAllClicks,
    selectClickById
} from "@shared/redux/clickSlice"
import { setIsClickMenuOpen } from "@shared/redux/contextMenuSlice"
import {
    selectIsMaskingModeEnabled,
    selectSelectedRow,
    setOpenSection,
    setSelectedRow
} from "@shared/redux/timelineSlice"
import Action from "./Action"

export default function Click({ id }) {

    const dispatch = useDispatch()

    const anim = useSelector(state => selectClickById(state, id))
    const anims = useSelector(selectAllClicks)
    const selectedRow = useSelector(selectSelectedRow)
    const isMinimized = useSelector(selectIsMaskingModeEnabled)

    const duration = useMemo(
        () => anim ? anim.end - anim.start : 0,
        [anim])

    const start = useMemo(
        () => anim ? anim.start : 0,
        [anim])

    const onSelect = () => {
        dispatch(setSelectedRow(CLICKS))
        dispatch(setOpenSection(CLICKS))
    }

    const onContextMenu = () => {
        dispatch(setSelectedRow(CLICKS))
        dispatch(setOpenSection(CLICKS))
        dispatch(setIsClickMenuOpen(true))
    }

    if (!anim) return null

    return (<Action anim={anim} anims={anims} start={start} duration={duration}
        isRowSelected={selectedRow === CLICKS} isActive={anim.isActive} onSelect={onSelect}
        onContextMenu={onContextMenu} color="accent" isMinimized={isMinimized} />)
}

Click.propTypes = {
    id: PropTypes.string.isRequired
}