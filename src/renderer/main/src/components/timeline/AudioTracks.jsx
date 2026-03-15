import { useCallback, useMemo, useState } from "react"
import {
    useDispatch,
    useSelector
} from "react-redux"
import { AUDIO_TRACKS, pxToMs } from "../../../../src/helpers"
import {
    addAudioClip,
    selectAllAudioClips,
    selectAudioTracks,
} from "../../../../src/redux/audioTrackSlice"
import {
    selectIsMaskingModeEnabled,
    selectPxPerMs,
} from "../../../../src/redux/timelineSlice"
import { selectDuration } from "../../../../src/redux/editorSlice"
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

    const handleDrop = useCallback((e, trackId) => {
        e.preventDefault()
        e.stopPropagation()
        setDragOverTrack(null)
        try {
            const data = JSON.parse(e.dataTransfer.getData("application/json"))
            if (data.type === "audio" || data.category === "audio") {
                const rect = e.currentTarget.getBoundingClientRect()
                const offsetX = e.clientX - rect.left
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
        } catch { /* ignore invalid drops */ }
    }, [dispatch, duration, pxPerMs])

    const handleDragOver = useCallback((e, trackId) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = "copy"
        setDragOverTrack(trackId)
    }, [])

    const handleDragLeave = useCallback(() => setDragOverTrack(null), [])

    if (tracks.length === 0) return null

    return tracks.map(track => (
        <div key={`audio-track-${track.id}`}
            onDrop={e => handleDrop(e, track.id)}
            onDragOver={e => handleDragOver(e, track.id)}
            onDragLeave={handleDragLeave}
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
                    <span className="text-[10px] opacity-20">Double-click to import audio, or drag from Assets</span>
                </div>
            )}
        </div>
    ))
}
