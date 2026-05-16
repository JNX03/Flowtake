import {
    EyeIcon,
    EyeSlashIcon,
    PencilSquareIcon,
    RectangleGroupIcon,
    ScissorsIcon,
    Squares2X2Icon,
    ViewColumnsIcon
} from "@heroicons/react/16/solid"
import { useCallback, useMemo } from "react"
import { useHotkeys } from "react-hotkeys-hook"
import { useDispatch, useSelector } from "react-redux"
import {
    addAppScene,
    removeAppScene,
    selectAppSceneById,
    updateAppScene
} from "@shared/redux/appSceneAnimSlice"
import {
    selectIsAppSceneMenuOpen,
    selectAppSceneId,
    selectTime,
    setIsAppSceneMenuOpen
} from "@shared/redux/contextMenuSlice"
import {
    selectAreHotkeysEnabled,
    selectIsPlaying
} from "@shared/redux/editorSlice"
import { selectExtraTracks } from "@shared/redux/projectSlice"
import DeleteButton from "./DeleteButton"
import Divider from "./Divider"
import Item from "./Item"
import Menu from "./Menu"

const CORNERS = ["tl", "tr", "bl", "br", "hidden"]
const CORNER_LABELS = {
    tl: "Top-left", tr: "Top-right", bl: "Bottom-left", br: "Bottom-right", hidden: "Hidden",
}

const cycleCorner = (cur) => CORNERS[(CORNERS.indexOf(cur) + 1) % CORNERS.length]

const LAYOUTS = ["pip", "sidebyside", "grid"]
const LAYOUT_LABELS = { pip: "Picture-in-picture", sidebyside: "Side-by-side", grid: "Grid" }
const LAYOUT_ICONS = { pip: RectangleGroupIcon, sidebyside: ViewColumnsIcon, grid: Squares2X2Icon }
const cycleLayout = (cur) => LAYOUTS[(LAYOUTS.indexOf(cur || "pip") + 1) % LAYOUTS.length]

export default function AppSceneMenu() {
    const dispatch = useDispatch()

    const isOpen = useSelector(selectIsAppSceneMenuOpen)
    const id = useSelector(selectAppSceneId)
    const entity = useSelector(state => id ? selectAppSceneById(state, id) : null)
    const tracks = useSelector(selectExtraTracks)
    const time = useSelector(selectTime)
    const areHotkeysEnabled = useSelector(selectAreHotkeysEnabled)
    const isPlaying = useSelector(selectIsPlaying)

    const close = useCallback(() => dispatch(setIsAppSceneMenuOpen(false)), [dispatch])

    const isSplittingEnabled = useMemo(
        () => entity && time > entity.start && time < entity.end,
        [entity, time]
    )

    const onSplit = useCallback(() => {
        if (!entity || !isSplittingEnabled) return
        const t = time
        dispatch(updateAppScene({ id: entity.id, changes: { end: t } }))
        dispatch(addAppScene({
            id: `scn-${crypto.randomUUID()}`,
            start: t,
            end: entity.end,
            layout: entity.layout || "pip",
            mainTrackId: entity.mainTrackId,
            slots: { ...(entity.slots || {}) },
        }))
        close()
    }, [dispatch, entity, isSplittingEnabled, time, close])

    const cycleMain = useCallback(() => {
        if (!entity || !Array.isArray(tracks) || tracks.length === 0) return
        const idx = tracks.findIndex(t => t.id === entity.mainTrackId)
        const next = tracks[(idx + 1) % tracks.length]
        // Move the previous main into top-right corner so it doesn't disappear.
        const slots = { ...(entity.slots || {}) }
        if (entity.mainTrackId && entity.mainTrackId !== next.id) {
            slots[entity.mainTrackId] = slots[entity.mainTrackId] || "tr"
        }
        delete slots[next.id]
        dispatch(updateAppScene({ id: entity.id, changes: { mainTrackId: next.id, slots } }))
    }, [dispatch, entity, tracks])

    const cycleSlot = useCallback((trackId) => {
        if (!entity) return
        const cur = entity.slots?.[trackId] || "tr"
        const next = cycleCorner(cur)
        dispatch(updateAppScene({
            id: entity.id,
            changes: { slots: { ...(entity.slots || {}), [trackId]: next } }
        }))
    }, [dispatch, entity])

    const onCycleLayout = useCallback(() => {
        if (!entity) return
        const next = cycleLayout(entity.layout)
        dispatch(updateAppScene({ id: entity.id, changes: { layout: next } }))
    }, [dispatch, entity])

    const onDelete = useCallback(() => {
        if (!entity) return
        dispatch(removeAppScene(entity.id))
        close()
    }, [dispatch, entity, close])

    useHotkeys('s', () => onSplit(),
        { enabled: areHotkeysEnabled && !!isSplittingEnabled && !isPlaying },
        [areHotkeysEnabled, isSplittingEnabled, isPlaying, onSplit])

    useHotkeys('delete', () => onDelete(),
        { enabled: areHotkeysEnabled && isOpen && !isPlaying },
        [areHotkeysEnabled, isOpen, isPlaying, onDelete])

    if (!entity) return null

    const mainName = (Array.isArray(tracks)
        ? tracks.find(t => t.id === entity.mainTrackId)?.name
        : null) || "(none)"

    const otherTracks = (Array.isArray(tracks) ? tracks : [])
        .filter(t => t.id !== entity.mainTrackId)

    const layout = entity.layout || "pip"
    const LayoutIcon = LAYOUT_ICONS[layout] || RectangleGroupIcon
    const showCornerControls = layout === "pip"

    return (
        <Menu isOpen={isOpen} close={close}>
            <Item text="Split at time cursor" icon={ScissorsIcon} isEnabled={!!isSplittingEnabled}
                onClick={onSplit} kbd={<kbd className="kbd kbd-sm">s</kbd>} />
            <Divider />
            <Item text={`Layout: ${LAYOUT_LABELS[layout]}`} icon={LayoutIcon}
                isEnabled={true} onClick={onCycleLayout} />
            <Item text={`Main: ${mainName}`} icon={RectangleGroupIcon}
                isEnabled={Array.isArray(tracks) && tracks.length > 1} onClick={cycleMain} />
            {showCornerControls && otherTracks.map(t => {
                const slot = entity.slots?.[t.id] || "hidden"
                return (
                    <Item key={t.id}
                        text={`${t.name}: ${CORNER_LABELS[slot] || slot}`}
                        icon={slot === "hidden" ? EyeSlashIcon : EyeIcon}
                        isEnabled={true}
                        onClick={() => cycleSlot(t.id)} />
                )
            })}
            {!showCornerControls && otherTracks.map(t => {
                const slot = entity.slots?.[t.id] || "hidden"
                const isVisible = slot && slot !== "hidden"
                return (
                    <Item key={t.id}
                        text={`${t.name}: ${isVisible ? "Visible" : "Hidden"}`}
                        icon={isVisible ? EyeIcon : EyeSlashIcon}
                        isEnabled={true}
                        onClick={() => cycleSlot(t.id)} />
                )
            })}
            <Item text="Edit in sidebar" icon={PencilSquareIcon} isEnabled={false} onClick={close} />
            <Divider />
            <DeleteButton onDelete={onDelete} />
        </Menu>
    )
}
