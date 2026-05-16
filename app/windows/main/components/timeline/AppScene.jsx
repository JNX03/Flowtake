import { RectangleGroupIcon } from "@heroicons/react/16/solid"
import PropTypes from "prop-types"
import { useCallback, useMemo } from "react"
import { useDispatch, useSelector } from "react-redux"
import { APP_SCENES } from "@shared/helpers"
import {
    selectAllAppScenes,
    selectAppSceneById,
    updateAppScene
} from "@shared/redux/appSceneAnimSlice"
import {
    setIsAppSceneMenuOpen,
    setAppSceneId
} from "@shared/redux/contextMenuSlice"
import { selectExtraTracks } from "@shared/redux/projectSlice"
import {
    selectIsMaskingModeEnabled,
    selectSelectedRow,
    setOpenSection,
    setSelectedRow
} from "@shared/redux/timelineSlice"
import FlexibleAction from "./FlexibleAction"
import Label from "./Label"

export default function AppScene({ id }) {
    const dispatch = useDispatch()

    const anim = useSelector(state => selectAppSceneById(state, id))
    const anims = useSelector(selectAllAppScenes)
    const tracks = useSelector(selectExtraTracks)
    const selectedRow = useSelector(selectSelectedRow)
    const isMinimized = useSelector(selectIsMaskingModeEnabled)

    const mainName = useMemo(() => {
        if (!anim?.mainTrackId || !Array.isArray(tracks)) return "(no main)"
        return tracks.find(t => t.id === anim.mainTrackId)?.name || anim.mainTrackId
    }, [anim, tracks])

    const visibleSecondaries = useMemo(() => {
        if (!anim?.slots) return 0
        return Object.values(anim.slots).filter(v => v && v !== "hidden").length
    }, [anim])

    const layoutLabel = useMemo(() => {
        switch (anim?.layout) {
            case "sidebyside": return "Side-by-side"
            case "grid": return "Grid"
            case "pip":
            default: return "PiP"
        }
    }, [anim])

    const onChange = useCallback(
        (start, end) => dispatch(updateAppScene({ id, changes: { start, end } })),
        [dispatch, id]
    )

    const onSelect = useCallback(() => {
        dispatch(setSelectedRow(APP_SCENES))
        dispatch(setOpenSection(APP_SCENES))
    }, [dispatch])

    const onContextMenu = useCallback(() => {
        dispatch(setSelectedRow(APP_SCENES))
        dispatch(setOpenSection(APP_SCENES))
        dispatch(setAppSceneId(id))
        dispatch(setIsAppSceneMenuOpen(true))
    }, [dispatch, id])

    if (!anim) return null

    return (
        <FlexibleAction anim={anim} anims={anims} isRowSelected={selectedRow === APP_SCENES}
            onChange={onChange} onSelect={onSelect} onContextMenu={onContextMenu}
            color="accent" isMinimized={isMinimized}>
            <Label
                isMinimized={isMinimized}
                line1={<><RectangleGroupIcon className="size-4 shrink-0 mr-1" />{layoutLabel}</>}
                line2={<>
                    <span className="truncate">Main: {mainName}</span>
                    {visibleSecondaries > 0 && (
                        <span className="opacity-60">+{visibleSecondaries}</span>
                    )}
                </>}
            />
        </FlexibleAction>
    )
}

AppScene.propTypes = {
    id: PropTypes.string.isRequired,
}
