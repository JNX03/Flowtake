import {
    DocumentTextIcon,
    PhotoIcon,
    Square2StackIcon
} from "@heroicons/react/16/solid"
import PropTypes from "prop-types"
import { useCallback } from "react"
import {
    useDispatch,
    useSelector
} from "react-redux"
import { OVERLAY_TRACKS } from "../../../../src/helpers"
import {
    selectOverlayById,
    selectAllOverlays,
    updateOverlay
} from "../../../../src/redux/overlaySlice"
import {
    selectSelectedRow,
    setOpenSection,
    setSelectedRow
} from "../../../../src/redux/timelineSlice"
import FlexibleAction from "./FlexibleAction"
import Label from "./Label"

export default function OverlayItem({ id }) {

    const dispatch = useDispatch()

    const anim = useSelector(state => selectOverlayById(state, id))
    const anims = useSelector(selectAllOverlays)
    const selectedRow = useSelector(selectSelectedRow)

    const trackAnims = anims.filter(a => a.trackIndex === anim?.trackIndex)

    const onChange = useCallback(
        (start, end) => dispatch(updateOverlay({ id, changes: { start, end } })),
        [dispatch, id]
    )

    const onTrackChange = useCallback(
        (start, end, newTrackId) => dispatch(updateOverlay({ id, changes: { start, end, trackIndex: newTrackId } })),
        [dispatch, id]
    )

    const getTrackAnims = useCallback(
        (trackId) => anims.filter(a => a.trackIndex === trackId),
        [anims]
    )

    const onSelect = useCallback(() => {
        dispatch(setSelectedRow(OVERLAY_TRACKS))
        dispatch(setOpenSection(OVERLAY_TRACKS))
    }, [dispatch])

    if (!anim) return null

    const getIcon = () => {
        switch (anim.overlayType) {
            case "text": return <DocumentTextIcon className="size-4 shrink-0 mr-1" />
            case "image": return <PhotoIcon className="size-4 shrink-0 mr-1" />
            case "shape": return <Square2StackIcon className="size-4 shrink-0 mr-1" />
            default: return <Square2StackIcon className="size-4 shrink-0 mr-1" />
        }
    }

    const getTypeName = () => {
        switch (anim.overlayType) {
            case "text": return anim.text || "Text"
            case "image": return anim.name || "Image"
            case "shape": return anim.shapeType || "Shape"
            default: return "Overlay"
        }
    }

    return (
        <FlexibleAction anim={anim} anims={trackAnims} isRowSelected={selectedRow === OVERLAY_TRACKS}
            onChange={onChange} onSelect={onSelect} color="accent"
            crossTrackEnabled currentTrackId={anim.trackIndex}
            trackDropZone="overlay-track" getTrackAnims={getTrackAnims}
            onTrackChange={onTrackChange}>
            <Label
                line1={<>{getIcon()}{getTypeName()}</>}
                line2={<span className="opacity-60 text-[10px]">{anim.overlayType}</span>}
            />
        </FlexibleAction>
    )
}

OverlayItem.propTypes = {
    id: PropTypes.string.isRequired
}
