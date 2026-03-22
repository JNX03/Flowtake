import PropTypes from "prop-types"
import {
    useCallback,
    useRef
} from "react"
import { useSelector } from "react-redux"
import { msToPx } from "@shared/helpers"
import { selectAllAudioClips } from "@shared/redux/audioTrackSlice"
import { selectAllClips } from "@shared/redux/clipSlice"
import { selectDuration } from "@shared/redux/editorSlice"
import { selectAllMasks } from "@shared/redux/maskSlice"
import { selectAllOverlays } from "@shared/redux/overlaySlice"
import { selectAllSubtitles } from "@shared/redux/subtitleSlice"
import {
    selectPxPerMs,
    selectScrollLeft
} from "@shared/redux/timelineSlice"
import { selectAllZooms } from "@shared/redux/zoomSlice"

const TRACK_COLORS = {
    clips: "bg-primary/60",
    zooms: "bg-secondary/60",
    subtitles: "bg-accent/60",
    masks: "bg-neutral/60",
    audio: "bg-info/60",
    overlays: "bg-warning/60",
}

export default function Minimap({ containerRef }) {

    const duration = useSelector(selectDuration)
    const pxPerMs = useSelector(selectPxPerMs)
    const scrollLeft = useSelector(selectScrollLeft)

    const clips = useSelector(selectAllClips)
    const zooms = useSelector(selectAllZooms)
    const subtitles = useSelector(selectAllSubtitles)
    const masks = useSelector(selectAllMasks)
    const audioClips = useSelector(selectAllAudioClips)
    const overlays = useSelector(selectAllOverlays)

    const barRef = useRef(null)

    const viewportWidthMs = containerRef?.current
        ? containerRef.current.clientWidth / pxPerMs
        : duration
    const scrollMs = scrollLeft / pxPerMs

    const handleClick = useCallback(e => {
        if (!barRef.current || !containerRef?.current || !duration) return
        const rect = barRef.current.getBoundingClientRect()
        const clickX = e.clientX - rect.left
        const clickMs = (clickX / rect.width) * duration
        // Center viewport on click position
        const targetScroll = msToPx(clickMs - viewportWidthMs / 2, pxPerMs)
        containerRef.current.scrollLeft = Math.max(0, targetScroll)
    }, [containerRef, duration, pxPerMs, viewportWidthMs])

    if (!duration) return null

    const toPercent = ms => (ms / duration) * 100

    const renderEntities = (entities, colorClass) =>
        entities.map(e => (
            <div key={e.id} className={`absolute h-full rounded-[1px] ${colorClass}`}
                style={{
                    left: `${toPercent(e.start)}%`,
                    width: `${Math.max(toPercent(e.end - e.start), 0.3)}%`
                }} />
        ))

    const vpLeft = toPercent(scrollMs)
    const vpWidth = Math.min(toPercent(viewportWidthMs), 100 - vpLeft)

    return (
        <div ref={barRef}
            className="h-4 shrink-0 relative cursor-pointer bg-base-300/50 border-b border-base-content/5"
            onClick={handleClick}>
            {/* Entity bars */}
            <div className="absolute inset-0 flex flex-col">
                <div className="flex-1 relative">{renderEntities(clips, TRACK_COLORS.clips)}</div>
                <div className="flex-1 relative">{renderEntities(zooms, TRACK_COLORS.zooms)}</div>
                <div className="flex-1 relative">
                    {renderEntities(subtitles, TRACK_COLORS.subtitles)}
                    {renderEntities(audioClips, TRACK_COLORS.audio)}
                    {renderEntities(overlays, TRACK_COLORS.overlays)}
                </div>
            </div>

            {/* Viewport indicator */}
            <div className="absolute top-0 bottom-0 border border-base-content/30 bg-base-content/5 rounded-sm pointer-events-none z-10"
                style={{
                    left: `${vpLeft}%`,
                    width: `${Math.max(vpWidth, 1)}%`
                }} />
        </div>
    )
}

Minimap.propTypes = {
    containerRef: PropTypes.shape({ current: PropTypes.any })
}
