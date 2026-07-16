import { useCallback, useEffect, useMemo, useState } from "react"
import { PlusIcon } from "@heroicons/react/16/solid"
import { convertFileSrc } from "@tauri-apps/api/core"
import { open } from "@tauri-apps/plugin-dialog"
import {
    useDispatch,
    useSelector,
    useStore
} from "react-redux"
import { subscribe, isDragActive, getHoverTarget } from "../../dragState"
import { addErrorToast } from "@shared/errorToastHelper"
import { AUDIO_TRACKS, clamp, pxToMs } from "@shared/helpers"
import { readAudioDurationMs } from "@shared/mediaMetadata"
import { isTauri } from "@shared/tauriBridge"
import {
    addAudioClip,
    addTrack,
    selectAllAudioClips,
    selectAudioTracks,
} from "@shared/redux/audioTrackSlice"
import { getGroup, withGroup } from "@shared/redux/actionEnhancers"
import {
    selectIsMaskingModeEnabled,
    selectPxPerMs,
} from "@shared/redux/timelineSlice"
import { selectDuration } from "@shared/redux/editorSlice"
import AudioClip from "./AudioClip"
import { resolveAudioTrackPlacement } from "./audioTrackPlacement"
import Row from "./Row"

export default function AudioTracks() {

    const dispatch = useDispatch()
    const store = useStore()

    const tracks = useSelector(selectAudioTracks)
    const allClips = useSelector(selectAllAudioClips)
    const isMinimized = useSelector(selectIsMaskingModeEnabled)
    const [dragOverTrack, setDragOverTrack] = useState(null)

    const clipsByTrack = useMemo(() => {
        const map = {}
        tracks.forEach(t => { map[t.id] = [] })
        allClips.forEach(c => {
            if (map[c.trackIndex] !== undefined) map[c.trackIndex].push(c)
        })
        return map
    }, [tracks, allClips])

    // Highlight track when pointer drag is active and hovering over it
    useEffect(() => subscribe(() => {
        if (!isDragActive()) { setDragOverTrack(null); return }
        const hover = getHoverTarget()
        const hoveredTrack = tracks.find(track => track.id === hover?.trackId)
        if (hover?.zone === "audio-track" && hoveredTrack && !hoveredTrack.locked) setDragOverTrack(hover.trackId)
        else setDragOverTrack(null)
    }), [tracks])

    const insertAudioClip = useCallback(({ preferredTrackId, start, end, name, src, groupPrefix }) => {
        const state = store.getState()
        const currentTracks = selectAudioTracks(state)
        const currentClips = selectAllAudioClips(state)
        const placement = resolveAudioTrackPlacement({
            tracks: currentTracks,
            audioClips: currentClips,
            start,
            end,
            nextTrackId: state.undoableState.present.audioTrackAnims.nextTrackId,
            preferredTrackId,
        })
        const group = getGroup(groupPrefix)

        if (placement.needsNewTrack) dispatch(withGroup(addTrack(), group))
        dispatch(withGroup(addAudioClip({
            id: `audio-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            start,
            end,
            trackIndex: placement.trackId,
            name,
            volume: 1,
            src,
        }), group))
    }, [dispatch, store])

    const addAudioSource = useCallback(async (trackId, time, name, src) => {
        const clipDuration = await readAudioDurationMs(src) || 5000
        const currentDuration = selectDuration(store.getState())
        if (!currentDuration) return
        const start = clamp(time, 0, Math.max(0, currentDuration - Math.min(clipDuration, currentDuration)))
        insertAudioClip({
            preferredTrackId: trackId,
            start,
            end: Math.min(start + clipDuration, currentDuration),
            name,
            src,
            groupPrefix: "audio-import",
        })
    }, [insertAudioClip, store])

    const importAudioToTrack = useCallback(async (trackId, time) => {
        try {
            if (isTauri) {
                const selected = await open({
                    multiple: false,
                    directory: false,
                    filters: [{ name: "Audio", extensions: ["mp3", "wav", "ogg", "flac", "aac", "m4a", "wma"] }],
                })
                if (typeof selected === "string") {
                    await addAudioSource(trackId, time, selected.split(/[\\/]/).pop() || "Audio", convertFileSrc(selected))
                }
                return
            }

            const input = document.createElement("input")
            input.type = "file"
            input.accept = "audio/*"
            input.onchange = async e => {
                const file = e.target.files?.[0]
                if (!file) return
                const src = URL.createObjectURL(file)
                window.dispatchEvent(new CustomEvent("flowtake-object-url-created", { detail: { url: src } }))
                await addAudioSource(trackId, time, file.name, src)
            }
            input.click()
        } catch (error) {
            console.error("[Flowtake] Audio import failed", error)
            dispatch(addErrorToast("Couldn't add that audio file."))
        }
    }, [addAudioSource, dispatch])

    // Listen for custom pointer-based drop events
    useEffect(() => {
        const handleDrop = (e) => {
            const { data, target, clientX } = e.detail
            if (!data || !target) return
            if (target.zone !== "audio-track") return
            if (data.type !== "audio" && data.category !== "audio") return

            const state = store.getState()
            const currentDuration = selectDuration(state)
            if (!currentDuration) return
            const offsetX = clientX - target.rect.left
            const clipDuration = data.duration || 5000
            const time = clamp(
                pxToMs(offsetX, selectPxPerMs(state)),
                0,
                Math.max(0, currentDuration - Math.min(clipDuration, currentDuration))
            )
            insertAudioClip({
                preferredTrackId: target.trackId,
                start: time,
                end: Math.min(time + clipDuration, currentDuration),
                name: data.name || "Audio",
                src: data.src || null,
                groupPrefix: "audio-drop",
            })
        }
        window.addEventListener("flowtake-drop", handleDrop)
        return () => window.removeEventListener("flowtake-drop", handleDrop)
    }, [insertAudioClip, store])

    if (tracks.length === 0) return null

    return tracks.map(track => (
        <div key={`audio-track-${track.id}`}
            data-drop-zone="audio-track"
            data-drop-track-id={track.id}
            className={`relative transition-colors ${dragOverTrack === track.id ? "bg-secondary/10 ring-1 ring-secondary/30 ring-inset rounded" : ""}`}
        >
            <Row
                name={AUDIO_TRACKS}
                className="h-12"
                animIds={(clipsByTrack[track.id] || []).map(c => c.id)}
                action={AudioClip}
                onDoubleClick={time => { if (!track.locked) importAudioToTrack(track.id, time) }}
                isMinimized={isMinimized}
            />
            {(clipsByTrack[track.id] || []).length === 0 && !isMinimized && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <button
                        type="button"
                        onClick={() => importAudioToTrack(track.id, 0)}
                        disabled={track.locked}
                        className="pointer-events-auto text-xs opacity-60 hover:opacity-100 border border-dashed border-base-content/25 hover:border-secondary hover:bg-secondary/10 rounded-md px-3 py-1 transition-all flex items-center gap-1.5"
                    >
                        {!track.locked && <PlusIcon className="size-4" aria-hidden="true" />}
                        {track.locked ? "Track locked" : "Click to add audio"}
                    </button>
                </div>
            )}
        </div>
    ))
}
