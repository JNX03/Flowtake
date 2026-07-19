import PropTypes from "prop-types"
import {
    useCallback,
    useEffect,
    useRef,
    useState
} from "react"
import {
    useDispatch,
    useSelector
} from "react-redux"
import throttle from "throttleit"
import { useThrottledCallback } from "use-debounce"
import Media from "../../../components/Media"
import useVideoSrc from "@shared/hooks/useVideoSrc"
import { toS } from "@shared/helpers"
import { addErrorToast } from "@shared/errorToastHelper"
import {
    selectAreVideosReady,
    selectIsCleaningUpVideos,
    selectIsMuted,
    selectIsPlaying,
    selectMicrophoneAudioVolume,
    selectPlaybackRate,
    selectSystemAudioVolume,
    setAreVideosReady,
    setIsCleaningUpScene,
    setIsCleaningUpVideosDone
} from "@shared/redux/editorSlice"
import {
    selectExtraTracks,
    selectId,
    selectHasCameraVideo,
    selectHasMicrophoneAudio
} from "@shared/redux/projectSlice"
import { selectTime } from "@shared/redux/timelineSlice"

// TODO: Might be nice to replace video elements with mediafox maybe
// https://mediafox.pages.dev/?t=0JMb25X2iFm5BbeTa4ZGNA&s=09

export default function VideoWrapper({ screenVideoRef, cameraVideoRef, extraVideoRefs }) {

    const dispatch = useDispatch()

    const projectId = useSelector(selectId)
    const hasCameraVideo = useSelector(selectHasCameraVideo)
    const hasMicrophoneAudio = useSelector(selectHasMicrophoneAudio)
    const extraTracks = useSelector(selectExtraTracks)

    const screenVideo = useVideoSrc("screen-preview", projectId)
    const cameraVideo = useVideoSrc("camera", projectId)
    const microphoneAudio = useVideoSrc("microphone", projectId)

    const isPlaying = useSelector(selectIsPlaying)
    const playbackRate = useSelector(selectPlaybackRate)
    const microphoneAudioVolume = useSelector(selectMicrophoneAudioVolume)
    const systemAudioVolume = useSelector(selectSystemAudioVolume)
    const time = useSelector(selectTime)
    const isMuted = useSelector(selectIsMuted)
    const isCleaningUpVideos = useSelector(selectIsCleaningUpVideos)
    const areVideosReady = useSelector(selectAreVideosReady)

    const [isScreenVideoReady, setIsScreenVideoReady] = useState(false)
    const [isCameraVideoReady, setIsCameraVideoReady] = useState(false)

    const play = async video => {
        try {
            await video.play()
        } catch (e) {
            console.log(e)
        }
    }

    const cleanUpVideos = useCallback(async () => {
        if (screenVideoRef.current) {
            screenVideoRef.current.pause()
            await new Promise(resolve => {
                screenVideoRef.current.addEventListener("emptied", resolve, { once: true })
                screenVideoRef.current.src = ""
                screenVideoRef.current.load()
            })
        }
        if ((hasCameraVideo || hasMicrophoneAudio) && cameraVideoRef.current) {
            cameraVideoRef.current.pause()
            await new Promise(resolve => {
                cameraVideoRef.current.addEventListener("emptied", resolve, { once: true })
                cameraVideoRef.current.src = ""
                cameraVideoRef.current.load()
            })
        }
        dispatch(setIsCleaningUpVideosDone(true))
    }, [dispatch, hasCameraVideo, hasMicrophoneAudio, screenVideoRef, cameraVideoRef])

    useEffect(() => {
        if ((hasCameraVideo || hasMicrophoneAudio) && screenVideoRef.current && cameraVideoRef.current) {
            const screen = screenVideoRef.current
            const camera = cameraVideoRef.current
            const onTimeUpdate = throttle(() => {
                if (Math.abs(screen.currentTime - camera.currentTime) > 0.15)
                    camera.currentTime = screen.currentTime
            }, 200)
            const onPlay = async () => play(camera)
            const onPause = () => camera.pause()
            const onSeeked = () => camera.currentTime = screen.currentTime
            const onRateChange = () => camera.playbackRate = screen.playbackRate

            screen.addEventListener('play', onPlay)
            screen.addEventListener('pause', onPause)
            screen.addEventListener('seeked', onSeeked)
            screen.addEventListener('timeupdate', onTimeUpdate)
            screen.addEventListener('ratechange', onRateChange)

            return () => {
                screen.removeEventListener('play', onPlay)
                screen.removeEventListener('pause', onPause)
                screen.removeEventListener('seeked', onSeeked)
                screen.removeEventListener('timeupdate', onTimeUpdate)
                screen.removeEventListener('ratechange', onRateChange)
            }
        }
    }, [hasCameraVideo, hasMicrophoneAudio, screenVideoRef, cameraVideoRef])

    useEffect(() => {
        if (!screenVideoRef.current) return
        if (isPlaying) play(screenVideoRef.current)
        else screenVideoRef.current.pause()
    }, [isPlaying, screenVideoRef])

    // Mirror screen play/pause + seek onto every extra-app video so PiPs stay in sync.
    // Each extra carries an optional startOffsetMs that compensates for the gap
    // between the main FFmpeg start and the per-app capture spawn.
    useEffect(() => {
        const screen = screenVideoRef.current
        if (!screen || !extraVideoRefs?.current?.length) return

        const offsetSecForIndex = (i) => {
            const ms = extraTracks?.[i]?.startOffsetMs
            return typeof ms === "number" ? ms / 1000 : 0
        }
        const targetTime = (i) => Math.max(0, screen.currentTime - offsetSecForIndex(i))

        const onPlay = () => extraVideoRefs.current.forEach(v => v && play(v))
        const onPause = () => extraVideoRefs.current.forEach(v => v?.pause())
        const onSeeked = () => extraVideoRefs.current.forEach((v, i) => {
            if (v) v.currentTime = targetTime(i)
        })
        const onRateChange = () => extraVideoRefs.current.forEach(v => {
            if (v) v.playbackRate = screen.playbackRate
        })
        const onTimeUpdate = throttle(() => {
            extraVideoRefs.current.forEach((v, i) => {
                if (v && Math.abs(v.currentTime - targetTime(i)) > 0.15) {
                    v.currentTime = targetTime(i)
                }
            })
        }, 200)

        screen.addEventListener("play", onPlay)
        screen.addEventListener("pause", onPause)
        screen.addEventListener("seeked", onSeeked)
        screen.addEventListener("ratechange", onRateChange)
        screen.addEventListener("timeupdate", onTimeUpdate)
        return () => {
            screen.removeEventListener("play", onPlay)
            screen.removeEventListener("pause", onPause)
            screen.removeEventListener("seeked", onSeeked)
            screen.removeEventListener("ratechange", onRateChange)
            screen.removeEventListener("timeupdate", onTimeUpdate)
        }
    }, [screenVideoRef, extraVideoRefs, extraTracks])

    // TODO: screen video has variable frame rate. synching really only matters when new frames are available.
    // instead of looking at currenttime, only sync when new frames are available with requestVideoFrameCallback
    const syncToTimeline = useThrottledCallback(() => {
        if (screenVideoRef.current && Math.abs(screenVideoRef.current.currentTime - toS(time)) > 0.05)
            screenVideoRef.current.currentTime = toS(time)
    }, 150)

    useEffect(() => {
        if (!screenVideoRef.current) return
        if (!isPlaying) screenVideoRef.current.currentTime = toS(time)
        else syncToTimeline()
    }, [isPlaying, syncToTimeline, time, screenVideoRef])

    useEffect(() => {
        console.log("[VideoWrapper] ready-check", {
            areVideosReady,
            isScreenVideoReady,
            isCameraVideoReady,
            hasCameraVideo,
            hasMicrophoneAudio,
            screenSrc: screenVideo.src,
            projectId,
        })
        if (!areVideosReady && isScreenVideoReady &&
            ((hasCameraVideo && isCameraVideoReady)
                || (!hasCameraVideo && hasMicrophoneAudio && isCameraVideoReady)
                || (!hasCameraVideo && !hasMicrophoneAudio))) {
            if (screenVideoRef.current) screenVideoRef.current.currentTime = toS(time)
            console.log("[VideoWrapper] videos ready -> dispatching setAreVideosReady(true)")
            dispatch(setAreVideosReady(true))
        }
    }, [areVideosReady, dispatch, hasCameraVideo, hasMicrophoneAudio, isCameraVideoReady, isScreenVideoReady, screenVideoRef, time, screenVideo.src, projectId])

    useEffect(() => {
        if (screenVideoRef.current) screenVideoRef.current.playbackRate = playbackRate
    }, [playbackRate, screenVideoRef])

    useEffect(() => {
        if (screenVideoRef.current) screenVideoRef.current.volume = systemAudioVolume
    }, [systemAudioVolume, screenVideoRef])

    useEffect(() => {
        if (cameraVideoRef.current) cameraVideoRef.current.volume = microphoneAudioVolume
    }, [microphoneAudioVolume, cameraVideoRef])

    useEffect(() => {
        if (isCleaningUpVideos) cleanUpVideos()
    }, [cleanUpVideos, isCleaningUpVideos])

    const onError = useCallback(() => {
        dispatch(setIsCleaningUpScene(true))
        dispatch(addErrorToast("Video couldn't be loaded. Please try again."))
    }, [dispatch])

    const onScreenVideoReady = useCallback(() => {
        setIsScreenVideoReady(true)
    }, [])

    const onCameraVideoReady = useCallback(() => {
        setIsCameraVideoReady(true)
    }, [])

    // Added id to bust cache, otherwise chrome doesn't update video when closing / opening project
    return (<div className="absolute -left-[9999px] -top-[9999px] opacity-0 pointer-events-none">
        {screenVideo.src && <Media
            isVideo={true}
            ref={screenVideoRef}
            src={screenVideo.src}
            isResolved={true}
            controls={true}
            muted={isMuted}
            onError={onError}
            onReady={onScreenVideoReady} />}
        {hasCameraVideo && cameraVideo.src && <Media
            isVideo={true}
            ref={cameraVideoRef}
            src={cameraVideo.src}
            isResolved={true}
            controls={true}
            muted={isMuted}
            onError={onError}
            onReady={onCameraVideoReady} />}
        {(!hasCameraVideo && hasMicrophoneAudio) && microphoneAudio.src && <Media
            isVideo={false}
            ref={cameraVideoRef}
            src={microphoneAudio.src}
            isResolved={true}
            controls={true}
            muted={isMuted}
            onError={onError}
            onReady={onCameraVideoReady} />}
        {Array.isArray(extraTracks) && extraTracks.map((track, i) => (
            <ExtraTrackMedia
                key={track.id ?? `extra-${i}`}
                index={i}
                projectId={projectId}
                isMuted={isMuted}
                onError={onError}
                onRefMount={(el) => {
                    if (extraVideoRefs?.current) extraVideoRefs.current[i] = el
                }}
            />
        ))}
    </div>)
}

VideoWrapper.propTypes = {
    screenVideoRef: PropTypes.object.isRequired,
    cameraVideoRef: PropTypes.object.isRequired,
    extraVideoRefs: PropTypes.object,
}

function ExtraTrackMedia({ index, projectId, isMuted, onError, onRefMount }) {
    const src = useVideoSrc(`extra-${index}`, projectId)
    const ref = useRef(null)

    useEffect(() => {
        onRefMount?.(ref.current)
        return () => onRefMount?.(null)
    }, [onRefMount, src.src])

    if (!src.src) return null
    return (
        <Media
            isVideo={true}
            ref={ref}
            src={src.src}
            isResolved={true}
            controls={false}
            muted={true}
            onError={onError}
            onReady={() => {}}
        />
    )
}

ExtraTrackMedia.propTypes = {
    index: PropTypes.number.isRequired,
    projectId: PropTypes.string,
    isMuted: PropTypes.bool,
    onError: PropTypes.func,
    onRefMount: PropTypes.func,
}
