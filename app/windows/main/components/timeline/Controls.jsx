import {
    ArrowLeftIcon,
    LinkIcon,
    LinkSlashIcon,
    MagnifyingGlassMinusIcon,
    MagnifyingGlassPlusIcon
} from "@heroicons/react/16/solid"
import { Bars4Icon } from "@heroicons/react/24/outline"
import PropTypes from "prop-types"
import {
    useCallback,
    useEffect,
    useMemo
} from "react"
import {
    useHotkeys
} from "react-hotkeys-hook"
import {
    useDispatch,
    useSelector
} from "react-redux"
import { selectAllAudioClips } from "@shared/redux/audioTrackSlice"
import {
    selectAllClicks
} from "@shared/redux/clickSlice"
import {
    selectAllClips
} from "@shared/redux/clipSlice"
import {
    selectAreHotkeysEnabled,
    selectDuration,
    selectIsPlaying
} from "@shared/redux/editorSlice"
import { selectAllMasks } from "@shared/redux/maskSlice"
import { selectAllOverlays } from "@shared/redux/overlaySlice"
import {
    selectAllSubtitles
} from "@shared/redux/subtitleSlice"
import {
    selectEditingMode,
    selectIsMaskingModeEnabled,
    selectIsSnappingEnabled,
    selectPxPerMs,
    selectScrollLeft,
    selectTime,
    selectWidth,
    setEditingMode,
    setIsMaskingModeEnabled,
    setIsSnappingEnabled,
    setPxPerMs,
    setSelectedIds,
    setSelectedRow,
    setSnappingLines
} from "@shared/redux/timelineSlice"
import {
    selectAllZooms
} from "@shared/redux/zoomSlice"

export default function Controls({ onScrollToStart }) {

    const MIN_SCALE = .05
    const MAX_SCALE = .3
    const STEP = .05

    const dispatch = useDispatch()

    const isPlaying = useSelector(selectIsPlaying)
    const time = useSelector(selectTime)
    const areHotkeysEnabled = useSelector(selectAreHotkeysEnabled)
    const isSnappingEnabled = useSelector(selectIsSnappingEnabled)
    const pxPerMs = useSelector(selectPxPerMs)
    const scrollLeft = useSelector(selectScrollLeft)
    const isMaskingModeEnabled = useSelector(selectIsMaskingModeEnabled)
    const editingMode = useSelector(selectEditingMode)
    const width = useSelector(selectWidth)
    const duration = useSelector(selectDuration)

    // Additional selectors for timeline functionality
    const clicks = useSelector(selectAllClicks)
    const clips = useSelector(selectAllClips)
    const zooms = useSelector(selectAllZooms)
    const subtitles = useSelector(selectAllSubtitles)
    const masks = useSelector(selectAllMasks)
    const audioClips = useSelector(selectAllAudioClips)
    const overlays = useSelector(selectAllOverlays)

    const steps = useMemo(() => {
        const result = [width / duration]
        for (let i = MIN_SCALE; i <= MAX_SCALE; i += STEP) {
            result.push(i)
        }
        result.sort()
        return result
    }, [duration, width])

    const onClickZoomIn = useCallback(() => {
        const currentIndex = steps.findIndex(step => step >= pxPerMs)
        const nextIndex = Math.min(currentIndex + 1, steps.length - 1)
        dispatch(setPxPerMs(steps[nextIndex]))
    }, [dispatch, pxPerMs, steps])

    const onClickZoomOut = useCallback(() => {
        const currentIndex = steps.findIndex(step => step >= pxPerMs)
        const prevIndex = Math.max(currentIndex - 1, 0)
        dispatch(setPxPerMs(steps[prevIndex]))
    }, [dispatch, pxPerMs, steps])

    const onClickEnableMaskingMode = useCallback(() => {
        dispatch(setSelectedIds([]))
        dispatch(setIsMaskingModeEnabled(!isMaskingModeEnabled))
        dispatch(setSelectedRow(null))
    }, [dispatch, isMaskingModeEnabled])

    const onToggleRippleMode = useCallback(() => {
        dispatch(setEditingMode(editingMode === "normal" ? "ripple" : "normal"))
    }, [dispatch, editingMode])

    useHotkeys('ctrl+minus', () => onClickZoomOut(),
        { enabled: areHotkeysEnabled },
        [areHotkeysEnabled])

    useHotkeys('ctrl+equal', () => onClickZoomIn(),
        { enabled: areHotkeysEnabled },
        [areHotkeysEnabled])

    useEffect(() => {
        if (isSnappingEnabled && !isPlaying) {
            const allElements = [...clicks, ...clips, ...zooms, ...subtitles, ...audioClips, ...overlays]
            if (isMaskingModeEnabled) allElements.push(...masks)
            let lines = allElements.flatMap(({ start, end }) => [start, end])
            lines.push(time)
            lines = [...new Set(lines)].sort((a, b) => a - b)
            dispatch(setSnappingLines(lines))
        }
    }, [isSnappingEnabled, clicks, clips, zooms, subtitles, masks, audioClips, overlays, time, isMaskingModeEnabled, isPlaying, dispatch])

    return (
        <div className="absolute right-1 bottom-4 z-50 flex flex-col justify-center">
            <div className="flex flex-col p-2 gap-2 bg-base-300/50 backdrop-blur-xs rounded-lg shadow-lg">
                <button className="btn btn-xs tooltip tooltip-left z-10" data-tip="Go to start"
                    onClick={onScrollToStart} disabled={isPlaying || scrollLeft === 0}>
                    <ArrowLeftIcon className="size-4" />
                </button>
                <div className="join tooltip tooltip-left" data-tip="Zoom">
                    <button className="btn btn-xs btn-square join-item z-10"
                        onClick={onClickZoomIn} disabled={pxPerMs >= steps.at(-1)}>
                        <MagnifyingGlassPlusIcon className="size-4" />
                    </button>
                    <button className="btn btn-xs btn-square join-item z-10"
                        onClick={onClickZoomOut} disabled={pxPerMs <= steps[0]}>
                        <MagnifyingGlassMinusIcon className="size-4" />
                    </button>
                </div>
                <button className="btn btn-xs tooltip tooltip-left z-10"
                    data-tip={isSnappingEnabled ? "Disable alignment helpers" : "Enable alignment helpers"}
                    onClick={() => { dispatch(setIsSnappingEnabled(!isSnappingEnabled)) }} disabled={isPlaying}>
                    {isSnappingEnabled
                        ? <LinkSlashIcon className="size-4" />
                        : <LinkIcon className="size-4" />}
                </button>
                <button className={`btn btn-xs ${isMaskingModeEnabled ? "btn-info" : ""} tooltip tooltip-left z-10`}
                    data-tip={isMaskingModeEnabled ? "Disable masking mode" : "Enable masking mode"}
                    onClick={onClickEnableMaskingMode} >
                    <Bars4Icon className="size-4" />
                </button>
                <button className={`btn btn-xs ${editingMode === "ripple" ? "btn-warning" : ""} tooltip tooltip-left z-10`}
                    data-tip={editingMode === "ripple" ? "Ripple editing (on)" : "Ripple editing (off)"}
                    onClick={onToggleRippleMode} disabled={isPlaying}>
                    <svg className="size-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M2 8h3l2-4 2 8 2-4h3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </button>
            </div>
        </div>
    )
}

Controls.propTypes = {
    onScrollToStart: PropTypes.func.isRequired
}