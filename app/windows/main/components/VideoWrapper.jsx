import PropTypes from "prop-types"
import {
    useCallback,
    useEffect,
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
import {
    TOAST_ERROR,
    toS
} from "@shared/helpers"
import { addToast } from "@shared/redux/appSlice"
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
    selectId,
    selectHasCameraVideo,
    selectHasMicrophoneAudio
} from "@shared/redux/projectSlice"
import { selectTime } from "@shared/redux/timelineSlice"

// TODO: Might be nice to replace video elements with mediafox maybe
// https://mediafox.pages.dev/?t=0JMb25X2iFm5BbeTa4ZGNA&s=09

export default function VideoWrapper({ screenVideoRef, cameraVideoRef }) {

    const dispatch = useDispatch()

    const projectId = useSelector(selectId)
    const hasCameraVideo = useSelector(selectHasCameraVideo)
    const hasMicrophoneAudio = useSelector(selectHasMicrophoneAudio)

    const screenVideo = useVideoSrc("screen", projectId)
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
                if (Math.abs(screen.currentTime - camera.currentTime) > 0.5)
                    camera.currentTime = screen.currentTime
            }, 500)
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

    // TODO: screen video has variable frame rate. synching really only matters when new frames are available.
    // instead of looking at currenttime, only sync when new frames are available with requestVideoFrameCallback
    const syncToTimeline = useThrottledCallback(() => {
        if (screenVideoRef.current && Math.abs(screenVideoRef.current.currentTime - toS(time)) > 0.2)
            screenVideoRef.current.currentTime = toS(time)
    }, 500)

    useEffect(() => {
        if (!screenVideoRef.current) return
        if (!isPlaying) screenVideoRef.current.currentTime = toS(time)
        else syncToTimeline()
    }, [isPlaying, syncToTimeline, time, screenVideoRef])

    useEffect(() => {
        if (!areVideosReady && isScreenVideoReady &&
            ((hasCameraVideo && isCameraVideoReady)
                || (!hasCameraVideo && hasMicrophoneAudio && isCameraVideoReady)
                || (!hasCameraVideo && !hasMicrophoneAudio))) {
            if (screenVideoRef.current) screenVideoRef.current.currentTime = toS(time)
            dispatch(setAreVideosReady(true))
        }
    }, [areVideosReady, dispatch, hasCameraVideo, hasMicrophoneAudio, isCameraVideoReady, isScreenVideoReady, screenVideoRef, time])

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
        dispatch(addToast({ type: TOAST_ERROR, text: "Video couldn't be loaded. Please try again." }))
    }, [dispatch])

    const onScreenVideoReady = useCallback(() => {
        setIsScreenVideoReady(true)
    }, [])

    const onCameraVideoReady = useCallback(() => {
        setIsCameraVideoReady(true)
    }, [])

    // Added id to bust cache, otherwise chrome doesn't update video when closing / opening project
    return (<div className="invisible absolute left-0 top-0 w-full grid grid-cols-2">
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
    </div>)
}

VideoWrapper.propTypes = {
    screenVideoRef: PropTypes.object.isRequired,
    cameraVideoRef: PropTypes.object.isRequired
}