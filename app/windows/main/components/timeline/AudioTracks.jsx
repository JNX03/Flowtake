import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { PlusIcon } from "@heroicons/react/16/solid"
import { open as openDialog } from "@tauri-apps/plugin-dialog"
import {
    useDispatch,
    useSelector
} from "react-redux"
import { subscribe, isDragActive, getHoverTarget } from "../../dragState"
import { AUDIO_TRACKS, pxToMs } from "@shared/helpers"
import {
    addAudioClip,
    addTrack,
    selectAllAudioClips,
    selectAudioTracks,
    selectNextAudioTrackId,
} from "@shared/redux/audioTrackSlice"
import { resolveAudioTrackPlacement } from "./audioTrackPlacement"
import {
    createAudioLaneItem,
    planTimelineLaneInsert,
} from "@shared/editor/timelineLaneInsert"
import { importProjectMedia } from "@shared/editor/projectMedia"
import { addAsset } from "@shared/redux/assetSlice"
import { upsertMedia } from "@shared/redux/sceneSlice"
import { isTauri } from "@shared/tauriBridge"
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
import AudioClip from "./AudioClip"
import Row from "./Row"

export default function AudioTracks() {

    const dispatch = useDispatch()

    const tracks = useSelector(selectAudioTracks)
    const allClips = useSelector(selectAllAudioClips)
    const isMinimized = useSelector(selectIsMaskingModeEnabled)
    const duration = useSelector(selectDuration)
    const isPlaying = useSelector(selectIsPlaying)
    const pxPerMs = useSelector(selectPxPerMs)
    const selectedIds = useSelector(selectSelectedIds)
    const nextTrackId = useSelector(selectNextAudioTrackId)
    const [dragOverTrack, setDragOverTrack] = useState(null)
    const latestInsertState = useRef(null)

    latestInsertState.current = {
        allClips,
        duration,
        isPlaying,
        nextTrackId,
        tracks,
    }

    const clipsByTrack = useMemo(() => {
        const map = {}
        tracks.forEach(t => { map[t.id] = [] })
        allClips.forEach(c => {
            if (map[c.trackIndex] !== undefined) map[c.trackIndex].push(c)
        })
        return map
    }, [tracks, allClips])
    const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds])
    const activeTrackIds = useMemo(() => new Set(
        allClips
            .filter(clip => selectedIdSet.has(clip.id))
            .map(clip => clip.trackIndex)
    ), [allClips, selectedIdSet])

    // Highlight track when pointer drag is active and hovering over it
    useEffect(() => subscribe(() => {
        if (!isDragActive()) { setDragOverTrack(null); return }
        const hover = getHoverTarget()
        if (hover?.zone === "audio-track") setDragOverTrack(hover.trackId)
        else setDragOverTrack(null)
    }), [])

    const insertAudioAsset = useCallback((trackId, time, asset) => {
        const latest = latestInsertState.current
        // Prefer the dropped-on lane, but fall back to another free unlocked
        // track (or a new one) rather than refusing the drop outright.
        const placement = resolveAudioTrackPlacement({
            tracks: latest.tracks,
            audioClips: latest.allClips,
            start: time,
            end: time + (asset.duration || 5000),
            nextTrackId: latest.nextTrackId,
            preferredTrackId: trackId,
        })
        const targetTrackId = placement.trackId
        // A track that does not exist yet is created below; plan against an
        // empty unlocked lane so the insert is not rejected as missing-track.
        const track = placement.needsNewTrack
            ? { id: targetTrackId, locked: false }
            : latest.tracks.find(item => item.id === targetTrackId)
        const plan = planTimelineLaneInsert({
            requestedStart: time,
            requestedDuration: asset.duration || 5000,
            projectDuration: latest.duration,
            track,
            items: placement.needsNewTrack
                ? []
                : latest.allClips.filter(clip => clip.trackIndex === targetTrackId),
            isPlaying: latest.isPlaying,
        })
        if (!plan.ok) return false

        const clip = createAudioLaneItem({
            id: `audio-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            trackId: targetTrackId,
            start: plan.start,
            end: plan.end,
            asset,
        })
        if (!clip) return false
        if (placement.needsNewTrack) dispatch(addTrack())
        dispatch(addAudioClip(clip))
        dispatch(setSelectedIds([clip.id]))
        dispatch(setSelectedRow(AUDIO_TRACKS))
        return true
    }, [dispatch])

    const importAudioToTrack = useCallback((trackId, time) => {
        const latest = latestInsertState.current
        const track = latest.tracks.find(item => item.id === trackId)
        const canInsert = planTimelineLaneInsert({
            requestedStart: time,
            requestedDuration: 1,
            projectDuration: latest.duration,
            track,
            items: latest.allClips.filter(clip => clip.trackIndex === trackId),
            isPlaying: latest.isPlaying,
        })
        if (!canInsert.ok) return

        const insertProbedAsset = (asset, onResolved = null) => {
            const audio = new Audio(asset.src)
            let settled = false
            const insert = candidateDuration => {
                if (settled) return
                settled = true
                const duration = Number.isFinite(candidateDuration)
                    && candidateDuration > 0
                    ? candidateDuration
                    : 5000
                const resolvedAsset = { ...asset, duration }
                onResolved?.(resolvedAsset)
                insertAudioAsset(trackId, time, resolvedAsset)
            }
            audio.addEventListener("loadedmetadata", () => {
                insert(Math.round(audio.duration * 1000))
            }, { once: true })
            audio.addEventListener("error", () => insert(5000), { once: true })
        }

        if (isTauri) {
            void openDialog({
                directory: false,
                multiple: false,
                filters: [{
                    name: "Audio files",
                    extensions: ["mp3", "wav", "m4a", "aac", "ogg", "flac", "opus", "webm"],
                }],
            }).then(async sourcePath => {
                if (!sourcePath || Array.isArray(sourcePath)) return
                const { metadata, asset } = await importProjectMedia(sourcePath)
                insertProbedAsset(asset, resolvedAsset => {
                    const durableMetadata = {
                        ...metadata,
                        duration: resolvedAsset.duration,
                    }
                    dispatch(upsertMedia(durableMetadata))
                    dispatch(addAsset({
                        ...resolvedAsset,
                        duration: resolvedAsset.duration,
                    }))
                })
            }).catch(error => {
                console.error("[timeline-audio] Could not import audio", error)
            })
            return
        }

        const input = document.createElement("input")
        input.type = "file"
        input.accept = "audio/*"
        input.onchange = e => {
            const file = e.target.files?.[0]
            if (!file) return
            const reader = new FileReader()
            reader.onload = () => {
                insertProbedAsset({
                    id: `session-audio-${Date.now()}`,
                    name: file.name,
                    type: "audio",
                    src: reader.result,
                    mimeType: file.type || null,
                })
            }
            reader.readAsDataURL(file)
        }
        input.click()
    }, [dispatch, insertAudioAsset])

    // Listen for custom pointer-based drop events
    useEffect(() => {
        const handleDrop = (e) => {
            const { data, target, clientX } = e.detail
            if (!data || !target) return
            if (target.zone !== "audio-track") return
            if (data.type !== "audio" && data.category !== "audio") return
            if (!target.rect || !Number.isFinite(clientX)) return

            const trackId = target.trackId
            const offsetX = clientX - target.rect.left
            const time = pxToMs(offsetX, pxPerMs)
            insertAudioAsset(trackId, time, data)
        }
        window.addEventListener("flowtake-drop", handleDrop)
        return () => window.removeEventListener("flowtake-drop", handleDrop)
    }, [insertAudioAsset, pxPerMs])

    if (tracks.length === 0) return null

    return tracks.map(track => (
        <div key={`audio-track-${track.id}`}
            data-drop-zone="audio-track"
            data-drop-track-id={track.id}
            className={`relative shrink-0 rounded-sm transition-colors ${activeTrackIds.has(track.id) ? "bg-secondary/8" : ""} ${dragOverTrack === track.id ? "bg-secondary/10 ring-1 ring-secondary/30 ring-inset" : ""}`}
        >
            <Row
                name={AUDIO_TRACKS}
                className="h-12"
                animIds={(clipsByTrack[track.id] || []).map(c => c.id)}
                action={AudioClip}
                onDoubleClick={time => importAudioToTrack(track.id, time)}
                isMinimized={isMinimized}
                isActive={activeTrackIds.has(track.id)}
            />
            {(clipsByTrack[track.id] || []).length === 0 && !isMinimized && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <button
                        type="button"
                        onClick={() => importAudioToTrack(track.id, 0)}
                        disabled={track.locked || isPlaying}
                        className="pointer-events-auto flex items-center gap-1.5 rounded-md border border-dashed border-base-content/20 px-2.5 py-1 text-[10px] text-base-content/45 transition-all hover:border-secondary/60 hover:bg-secondary/10 hover:text-base-content disabled:opacity-30"
                        aria-label={`Add audio to ${track.name}`}
                    >
                        <PlusIcon className="size-3" />
                        Add audio
                    </button>
                </div>
            )}
        </div>
    ))
}
