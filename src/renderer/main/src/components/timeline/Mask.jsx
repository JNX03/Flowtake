import {
    EyeIcon
} from "@heroicons/react/16/solid"
import { Bars4Icon } from "@heroicons/react/24/outline"
import PropTypes from "prop-types"
import { useCallback } from "react"
import {
    useDispatch,
    useSelector
} from "react-redux"
import { MASKS } from "../../../../src/helpers"
import {
    setIsMaskMenuOpen,
    setSelectedMaskRow
} from "../../../../src/redux/contextMenuSlice"
import {
    selectAllMasks,
    selectMaskById,
    updateMask
} from "../../../../src/redux/maskSlice"
import {
    selectSelectedRow,
    setOpenSection,
    setSelectedRow
} from "../../../../src/redux/timelineSlice"
import FlexibleAction from "./FlexibleAction"
import Label from "./Label"

export default function Mask({ id }) {

    const dispatch = useDispatch()

    const anim = useSelector(state => selectMaskById(state, id))
    const anims = useSelector(state => selectAllMasks(state, id))
    const selectedRow = useSelector(selectSelectedRow)

    const onChange = useCallback(
        (start, end) => dispatch(updateMask({ id, changes: { start, end } })),
        [dispatch, id]
    )

    const onSelect = useCallback(() => {
        dispatch(setSelectedRow(MASKS))
        dispatch(setOpenSection(MASKS))
    }, [dispatch])

    const onContextMenu = useCallback(() => {
        dispatch(setSelectedRow(MASKS))
        dispatch(setOpenSection(MASKS))
        dispatch(setIsMaskMenuOpen(true))
        dispatch(setSelectedMaskRow(anim.row))
    }, [dispatch, anim.row])

    const animsInRow = () => anims.filter(config => config.row === anim.row)

    return (<FlexibleAction anim={anim} anims={animsInRow()} isRowSelected={selectedRow === MASKS} onChange={onChange}
        onSelect={onSelect} onContextMenu={onContextMenu} color="neutral" >

        <Label
            line1={<><Bars4Icon className="size-4 shrink-0 mr-1" />Mask</>}
            line2={<span className="flex items-center gap-1">
                <EyeIcon className="size-3 shrink-0" />
                {Math.floor(anim.blurStrength * 100)}% blur
            </span>}
        />

    </FlexibleAction>)
}

Mask.propTypes = {
    id: PropTypes.string.isRequired
}