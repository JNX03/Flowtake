import { CheckCircleIcon } from "@heroicons/react/16/solid"
import PropTypes from 'prop-types'
import { useCallback } from "react"
import {
    useDispatch,
    useSelector
} from "react-redux"
import {
    CLICKS,
    CLIPS,
    MASKS,
    SUBTITLES,
    ZOOMS
} from "../../../../src/helpers"
import { selectClickIds } from "../../../../src/redux/clickSlice"
import { selectClipIds } from "../../../../src/redux/clipSlice"
import { selectMaskIds } from "../../../../src/redux/maskSlice"
import { selectSubtitleIds } from "../../../../src/redux/subtitleSlice"
import {
    selectSelectedRow,
    setSelectedIds
} from "../../../../src/redux/timelineSlice"
import { selectZoomIds } from "../../../../src/redux/zoomSlice"
import Item from "./Item"

export default function SelectAllButton({ close }) {

    const selectedRow = useSelector(selectSelectedRow)
    const clipAnimIds = useSelector(selectClipIds)
    const clickAnimIds = useSelector(selectClickIds)
    const zoomAnimIds = useSelector(selectZoomIds)
    const subtitleAnimIds = useSelector(selectSubtitleIds)
    const maskAnimIds = useSelector(selectMaskIds)

    const dispatch = useDispatch()

    const selectAll = useCallback(() => {
        close()

        switch (selectedRow) {
            case CLIPS:
                dispatch(setSelectedIds(clipAnimIds))
                break
            case CLICKS:
                dispatch(setSelectedIds(clickAnimIds))
                break
            case ZOOMS:
                dispatch(setSelectedIds(zoomAnimIds))
                break
            case SUBTITLES:
                dispatch(setSelectedIds(subtitleAnimIds))
                break
            case MASKS:
                dispatch(setSelectedIds(maskAnimIds))
                break
        }
    }, [close, dispatch, selectedRow, clipAnimIds, clickAnimIds, zoomAnimIds, subtitleAnimIds, maskAnimIds])

    return (<Item text="Select all" icon={CheckCircleIcon} isEnabled={true} onClick={selectAll} kbd={<>
        <kbd className="kbd kbd-sm">ctrl</kbd>
        <kbd className="kbd kbd-sm">a</kbd>
    </>} />)
}

SelectAllButton.propTypes = {
    close: PropTypes.func.isRequired
}