import {
    CubeIcon,
    EyeIcon
} from "@heroicons/react/16/solid"
import PropTypes from "prop-types"
import {
    useDispatch,
    useSelector
} from "react-redux"
import {
    SPATIALS
} from "@shared/helpers"
import {
    selectAllSpatials,
    selectSpatialById,
    updateSpatial
} from "@shared/redux/spatialSlice"
import {
    selectIsMaskingModeEnabled,
    selectSelectedRow,
    setOpenSection,
    setSelectedRow
} from "@shared/redux/timelineSlice"
import FlexibleAction from "./FlexibleAction"
import Label from "./Label"

export default function SpatialClip({ id }) {

    const dispatch = useDispatch()

    const spatial = useSelector(state => selectSpatialById(state, id))
    const spatials = useSelector(selectAllSpatials)
    const selectedRow = useSelector(selectSelectedRow)
    const isMinimized = useSelector(selectIsMaskingModeEnabled)

    const onChange = (start, end) => {
        dispatch(updateSpatial({ id: spatial.id, changes: { start, end } }))
    }

    const onSelect = () => {
        dispatch(setSelectedRow(SPATIALS))
        dispatch(setOpenSection(SPATIALS))
    }

    const onContextMenu = () => {
        dispatch(setSelectedRow(SPATIALS))
        dispatch(setOpenSection(SPATIALS))
    }

    const formatDeg = v => `${v > 0 ? '+' : ''}${v}°`

    return (<FlexibleAction anim={spatial} anims={spatials} isRowSelected={selectedRow === SPATIALS} onChange={onChange}
        onSelect={onSelect} onContextMenu={onContextMenu} color="accent" isMinimized={isMinimized}>

        <Label
            isMinimized={isMinimized}
            line1={<><CubeIcon className="size-4 shrink-0 mr-1" />Spatial</>}
            line2={<>
                <span className="flex items-center gap-1">
                    X:{formatDeg(spatial.rotateX)} Y:{formatDeg(spatial.rotateY)}
                </span>
                {spatial.eyeContactEnabled && <span className="flex items-center gap-1">
                    <EyeIcon className="size-3 shrink-0" />Eye Contact
                </span>}
            </>}
        />

    </FlexibleAction>)
}

SpatialClip.propTypes = {
    id: PropTypes.string.isRequired
}
