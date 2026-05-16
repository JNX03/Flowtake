import { useCallback, useEffect, useMemo, useState } from "react"
import {
    useDispatch,
    useSelector
} from "react-redux"
import { subscribe, isDragActive, getHoverTarget } from "../../dragState"
import { AUDIO_TRACKS, pxToMs } from "@shared/helpers"
import {
    addAudioClip,
    selectAllAudioClips,
    selectAudioTracks,
} from "@shared/redux/audioTrackSlice"
import {
    selectIsMaskingModeEnabled,
    selectPxPerMs,
} from "@shared/redux/timelineSlice"
import { selectDuration } from "@shared/redux/editorSlice"
import AudioClip from "./AudioClip"
import Row from "./Row"

export default function AudioTracks() {

    const dispatch = useDispatch()

    const tracks = useSelector(selectAudioTracks)
    const allClips = useSelector(selectAllAudioClips)
    const isMinimized = useSelector(selectIsMaskingModeEnabled)
    const duration = useSelector(selectDuration)
    const pxPerMs = useSelector(selectPxPerMs)
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
        if (hover?.zone === "audio-track") setDragOverTrack(hover.trackId)
        else setDragOverTrack(null)
    }), [])

    const importAudioToTrack = useCallback((trackId, time) => {
        const input = document.createElement("input")
        input.type = "file"
        input.accept = "audio/*"
        input.onchange = e => {
            const file = e.target.files?.[0]
            if (!file) return
            const reader = new FileReader()
            reader.onload = () => {
                const audio = new Audio(reader.result)
                audio.addEventListener("loadedmetadata", () => {
                    const clipDuration = Math.round(audio.duration * 1000)
                    dispatch(addAudioClip({
                        id: `audio-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                        start: Math.max(0, time),
                        end: Math.min(time + clipDuration, duration),
                        trackIndex: trackId,
                        name: file.name,
                        volume: 1,
                        src: reader.result
                    }))
                }, { once: true })
                audio.addEventListener("error", () => {
                    dispatch(addAudioClip({
                        id: `audio-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                        start: Math.max(0, time),
                        end: Math.min(time + 5000, duration),
                        trackIndex: trackId,
                        name: file.name,
                        volume: 1,
                        src: reader.result
                    }))
                }, { once: true })
            }
            reader.readAsDataURL(file)
        }
        input.click()
    }, [dispatch, duration])

    // Listen for custom pointer-based drop events
    useEffect(() => {
        const handleDrop = (e) => {
            const { data, target, clientX } = e.detail
            if (!data || !target) return
            if (target.zone !== "audio-track") return
            if (data.type !== "audio" && data.category !== "audio") return

            const trackId = target.trackId
            const offsetX = clientX - target.rect.left
            const time = pxToMs(offsetX, pxPerMs)
            const clipDuration = data.duration || 4000
            dispatch(addAudioClip({
                id: `audio-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                start: Math.max(0, time),
                end: Math.min(time + clipDuration, duration),
                trackIndex: trackId,
                name: data.name || "Audio",
                volume: 1,
                src: data.src || null
            }))
        }
        window.addEventListener("flowtake-drop", handleDrop)
        return () => window.removeEventListener("flowtake-drop", handleDrop)
    }, [dispatch, duration, pxPerMs])

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
                onDoubleClick={time => importAudioToTrack(track.id, time)}
                isMinimized={isMinimized}
            />
            {(clipsByTrack[track.id] || []).length === 0 && !isMinimized && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <button
                        type="button"
                        onClick={() => importAudioToTrack(track.id, 0)}
                        className="pointer-events-auto text-xs opacity-60 hover:opacity-100 border border-dashed border-base-content/25 hover:border-secondary hover:bg-secondary/10 rounded-md px-3 py-1 transition-all flex items-center gap-1.5"
                    >
                        <span className="text-base leading-none">+</span>
                        Click to add audio
                    </button>
                </div>
            )}
        </div>
    ))
}
