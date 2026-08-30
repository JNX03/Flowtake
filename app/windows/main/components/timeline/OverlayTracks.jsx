import { useCallback, useEffect, useMemo, useState } from "react"
import { PlusIcon } from "@heroicons/react/16/solid"
import {
    useDispatch,
    useSelector
} from "react-redux"
import { subscribe, isDragActive, getHoverTarget } from "../../dragState"
import { OVERLAY_TRACKS, pxToMs } from "@shared/helpers"
import {
    addOverlay,
    selectAllOverlays,
    selectOverlayTracks,
} from "@shared/redux/overlaySlice"
import {
    createOverlayLaneItem,
    getOverlayLaneInsertDuration,
    planTimelineLaneInsert,
} from "@shared/editor/timelineLaneInsert"
import {
    selectIsMaskingModeEnabled,
    selectPxPerMs,
    selectSelectedIds,
    setSelectedIds,
    setSelectedRow,
} from "@shared/redux/timelineSlice"
import {
    selectDuration,
    selectIsPlaying,
} from "@shared/redux/editorSlice"
import OverlayItem from "./OverlayItem"
import Row from "./Row"

export default function OverlayTracks() {

    const dispatch = useDispatch()

    const tracks = useSelector(selectOverlayTracks)
    const allOverlays = useSelector(selectAllOverlays)
    const isMinimized = useSelector(selectIsMaskingModeEnabled)
    const duration = useSelector(selectDuration)
    const isPlaying = useSelector(selectIsPlaying)
    const pxPerMs = useSelector(selectPxPerMs)
    const selectedIds = useSelector(selectSelectedIds)
    const [dragOverTrack, setDragOverTrack] = useState(null)

    const overlaysByTrack = useMemo(() => {
        const map = {}
        tracks.forEach(t => { map[t.id] = [] })
        allOverlays.forEach(o => {
            if (map[o.trackIndex] !== undefined) map[o.trackIndex].push(o)
        })
        return map
    }, [tracks, allOverlays])
    const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds])
    const activeTrackIds = useMemo(() => new Set(
        allOverlays
            .filter(overlay => selectedIdSet.has(overlay.id))
            .map(overlay => overlay.trackIndex)
    ), [allOverlays, selectedIdSet])

    // Highlight track when pointer drag is active and hovering over it
    useEffect(() => subscribe(() => {
        if (!isDragActive()) { setDragOverTrack(null); return }
        const hover = getHoverTarget()
        if (hover?.zone === "overlay-track") setDragOverTrack(hover.trackId)
        else setDragOverTrack(null)
    }), [])

    const insertOverlayAsset = useCallback((trackId, time, asset) => {
        const track = tracks.find(item => item.id === trackId)
        const plan = planTimelineLaneInsert({
            requestedStart: time,
            requestedDuration: getOverlayLaneInsertDuration(asset),
            projectDuration: duration,
            track,
            items: allOverlays.filter(overlay => overlay.trackIndex === trackId),
            isPlaying,
        })
        if (!plan.ok) return false

        const overlay = createOverlayLaneItem({
            id: `overlay-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            trackId,
            start: plan.start,
            end: plan.end,
            asset,
        })
        if (!overlay) return false

        dispatch(addOverlay(overlay))
        dispatch(setSelectedIds([overlay.id]))
        dispatch(setSelectedRow(OVERLAY_TRACKS))
        return true
    }, [allOverlays, dispatch, duration, isPlaying, tracks])

    const handleDoubleClick = useCallback((time, trackId) => {
        insertOverlayAsset(trackId, time, {
            type: "text",
            config: {
                text: "Text",
                fontSize: 32,
                fontWeight: 600,
                color: "#ffffff",
            },
        })
    }, [insertOverlayAsset])

    // Listen for custom pointer-based drop events
    useEffect(() => {
        const handleDrop = (e) => {
            const { data, target, clientX } = e.detail
            if (!data || !target) return
            if (target.zone !== "overlay-track") return
            // Audio goes to audio tracks only
            if (data.type === "audio" || data.category === "audio") return
            if (!target.rect || !Number.isFinite(clientX)) return

            const trackId = target.trackId
            const offsetX = clientX - target.rect.left
            const time = pxToMs(offsetX, pxPerMs)
            insertOverlayAsset(trackId, time, data)
        }
        window.addEventListener("flowtake-drop", handleDrop)
        return () => window.removeEventListener("flowtake-drop", handleDrop)
    }, [insertOverlayAsset, pxPerMs])

    if (tracks.length === 0) return null

    return tracks.map(track => (
        <div key={`overlay-track-${track.id}`}
            data-drop-zone="overlay-track"
            data-drop-track-id={track.id}
            className={`relative shrink-0 rounded-sm transition-colors ${activeTrackIds.has(track.id) ? "bg-accent/8" : ""} ${dragOverTrack === track.id ? "bg-accent/10 ring-1 ring-accent/30 ring-inset" : ""}`}
        >
            <Row
                name={OVERLAY_TRACKS}
                className="h-12"
                animIds={(overlaysByTrack[track.id] || []).map(o => o.id)}
                action={OverlayItem}
                onDoubleClick={time => handleDoubleClick(time, track.id)}
                isMinimized={isMinimized}
                isActive={activeTrackIds.has(track.id)}
            />
            {(overlaysByTrack[track.id] || []).length === 0 && !isMinimized && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <button
                        type="button"
                        onClick={() => handleDoubleClick(0, track.id)}
                        disabled={track.locked || isPlaying}
                        className="pointer-events-auto flex items-center gap-1.5 rounded-md border border-dashed border-base-content/20 px-2.5 py-1 text-[10px] text-base-content/45 transition-all hover:border-accent/60 hover:bg-accent/10 hover:text-base-content disabled:opacity-30"
                        aria-label={`Add text to ${track.name}`}
                    >
                        <PlusIcon className="size-3" />
                        Add text
                    </button>
                </div>
            )}
        </div>
    ))
}
