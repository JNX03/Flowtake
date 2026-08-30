import PropTypes from "prop-types"
import {
    useCallback,
    useEffect,
    useRef,
    useState
} from "react"
import {
    useDispatch,
    useSelector,
    useStore
} from "react-redux"
import throttle from "throttleit"
import Media from "../../../components/Media"
import useVideoSrc from "@shared/hooks/useVideoSrc"
import { toS } from "@shared/helpers"
import {
    findActivePlaybackClip,
    findNextPlaybackClip,
    getClipSourceRange,
    isFreezePlaybackRate,
    mediaTimeToClipTimelineMs,
    normalizePlaybackRate,
    shouldPublishPlaybackTime,
    timelineTimeToMediaMs
} from "@shared/editor/playbackClock"
import { addErrorToast } from "@shared/errorToastHelper"
import { selectAllClips } from "@shared/redux/clipSlice"
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
    setIsCleaningUpVideosDone,
    setIsPlaying
} from "@shared/redux/editorSlice"
import {
    selectExtraTracks,
    selectId,
    selectHasCameraVideo,
    selectHasMicrophoneAudio,
    selectVideoDetails
} from "@shared/redux/projectSlice"
import {
    selectTime,
    setTime
} from "@shared/redux/timelineSlice"
import TimelineAudioPlayback from "./TimelineAudioPlayback"

// TODO: Might be nice to replace video elements with mediafox maybe
// https://mediafox.pages.dev/?t=0JMb25X2iFm5BbeTa4ZGNA&s=09

export default function VideoWrapper({ screenVideoRef, cameraVideoRef, extraVideoRefs }) {

    const dispatch = useDispatch()
    const store = useStore()

    const projectId = useSelector(selectId)
    const hasCameraVideo = useSelector(selectHasCameraVideo)
    const hasMicrophoneAudio = useSelector(selectHasMicrophoneAudio)
    const extraTracks = useSelector(selectExtraTracks)
    const videoDetails = useSelector(selectVideoDetails)
    const clips = useSelector(selectAllClips)

    const screenVideo = useVideoSrc("screen", projectId)
    const cameraVideo = useVideoSrc("camera", projectId)
    const microphoneAudio = useVideoSrc("microphone", projectId)

    const isPlaying = useSelector(selectIsPlaying)
    const playbackRate = useSelector(selectPlaybackRate)
    const microphoneAudioVolume = useSelector(selectMicrophoneAudioVolume)
    const systemAudioVolume = useSelector(selectSystemAudioVolume)
    const isMuted = useSelector(selectIsMuted)
    const isCleaningUpVideos = useSelector(selectIsCleaningUpVideos)
    const areVideosReady = useSelector(selectAreVideosReady)

    const [isScreenVideoReady, setIsScreenVideoReady] = useState(false)
    const [isCameraVideoReady, setIsCameraVideoReady] = useState(false)
    const timelineTimeRef = useRef(selectTime(store.getState()))
    const publishedTimeRef = useRef(timelineTimeRef.current)

    const play = async video => {
        if (!video) return false
        try {
            await video.play()
            return true
        } catch (e) {
            console.log(e)
            return false
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
        const video = screenVideoRef.current
        if (!video) return

        if (isPlaying) {
            const currentTime = selectTime(store.getState())
            const activeClip = findActivePlaybackClip(
                clips,
                currentTime,
                videoDetails.end
            )
            if (!activeClip) {
                video.pause()
            } else if (isFreezePlaybackRate(activeClip.playbackRate)) {
                video.pause()
                const mediaTime = toS(timelineTimeToMediaMs(
                    clips,
                    currentTime,
                    videoDetails.end
                ))
                if (Math.abs(video.currentTime - mediaTime) > 0.004)
                    video.currentTime = mediaTime
            } else {
                void play(video).then(didPlay => {
                    if (!didPlay) dispatch(setIsPlaying(false))
                })
            }
        } else {
            video.pause()
        }
    }, [
        clips,
        dispatch,
        isPlaying,
        screenVideoRef,
        store,
        videoDetails.end
    ])

    // Redux owns explicit seeks while paused. During playback the media element
    // becomes the source of truth, so a stalled decoder cannot leave the
    // playhead running ahead of the visible frame.
    useEffect(() => {
        const syncPausedTimelineTime = () => {
            const state = store.getState()
            const nextTime = selectTime(state)
            timelineTimeRef.current = nextTime

            if (selectIsPlaying(state)) return
            const video = screenVideoRef.current
            if (!video || !Number.isFinite(nextTime)) return

            const activeClip = findActivePlaybackClip(clips, nextTime, videoDetails.end)
            if (!activeClip) return
            const nextTimeSeconds = toS(timelineTimeToMediaMs(clips, nextTime, videoDetails.end))
            if (Math.abs(video.currentTime - nextTimeSeconds) > 0.004)
                video.currentTime = nextTimeSeconds
        }

        syncPausedTimelineTime()
        return store.subscribe(syncPausedTimelineTime)
    }, [clips, screenVideoRef, store, videoDetails.end])

    useEffect(() => {
        const video = screenVideoRef.current
        if (!video || !isPlaying || !areVideosReady) return

        let isDisposed = false
        let animationFrameId = null
        let timelineClock = null
        let playingClipId = null

        const publishTimelineTime = nextTime => {
            timelineTimeRef.current = nextTime

            if (shouldPublishPlaybackTime(nextTime, publishedTimeRef.current)) {
                publishedTimeRef.current = nextTime
                dispatch(setTime(nextTime))
            }
        }

        const stopPlayback = finalTime => {
            const clampedTime = Math.min(finalTime, videoDetails.end)
            timelineTimeRef.current = clampedTime
            publishedTimeRef.current = clampedTime
            dispatch(setTime(clampedTime))
            dispatch(setIsPlaying(false))
        }

        const seekVideo = nextTime => {
            const nextSeconds = toS(nextTime)
            if (Math.abs(video.currentTime - nextSeconds) > 0.004)
                video.currentTime = nextSeconds
        }

        const ensureVideoPlaying = () => {
            if (!video.paused || video.ended) return
            void play(video).then(didPlay => {
                if (!didPlay && !isDisposed) dispatch(setIsPlaying(false))
            })
        }

        const startTimelineClock = ({
            kind,
            clip = null,
            now,
            timelineStart,
            timelineEnd,
        }) => {
            video.pause()
            if (clip) {
                seekVideo(timelineTimeToMediaMs(
                    [clip],
                    timelineStart,
                    clip.end
                ))
            }
            playingClipId = null
            timelineClock = {
                kind,
                clipId: clip?.id ?? null,
                startedAt: now,
                timelineStart,
                timelineEnd,
            }
        }

        const onAnimationFrame = now => {
            if (isDisposed) return

            let nextTime = timelineTimeRef.current
            let activeClip = findActivePlaybackClip(
                clips,
                nextTime,
                videoDetails.end
            )

            if (!activeClip) {
                const nextClip = findNextPlaybackClip(clips, nextTime)
                const gapEnd = Math.min(nextClip?.start ?? videoDetails.end, videoDetails.end)
                const needsGapClock = !timelineClock
                    || timelineClock.kind !== "gap"
                    || timelineClock.timelineEnd !== gapEnd
                    || nextTime < timelineClock.timelineStart
                if (needsGapClock) {
                    startTimelineClock({
                        kind: "gap",
                        now,
                        timelineStart: nextTime,
                        timelineEnd: gapEnd,
                    })
                }

                nextTime = Math.min(
                    timelineClock.timelineEnd,
                    timelineClock.timelineStart + (now - timelineClock.startedAt)
                )
                publishTimelineTime(nextTime)

                if (nextTime >= timelineClock.timelineEnd) {
                    timelineClock = null
                    if (nextTime >= videoDetails.end) {
                        stopPlayback(videoDetails.end)
                        return
                    }
                }
            } else if (isFreezePlaybackRate(activeClip.playbackRate)) {
                const needsFreezeClock = !timelineClock
                    || timelineClock.kind !== "freeze"
                    || timelineClock.clipId !== activeClip.id
                    || nextTime < timelineClock.timelineStart
                if (needsFreezeClock) {
                    startTimelineClock({
                        kind: "freeze",
                        clip: activeClip,
                        now,
                        timelineStart: Math.min(
                            activeClip.end,
                            Math.max(activeClip.start, nextTime)
                        ),
                        timelineEnd: activeClip.end,
                    })
                }

                nextTime = Math.min(
                    timelineClock.timelineEnd,
                    timelineClock.timelineStart + (now - timelineClock.startedAt)
                )
                publishTimelineTime(nextTime)

                if (nextTime >= activeClip.end) {
                    timelineClock = null
                    if (nextTime >= videoDetails.end) {
                        stopPlayback(videoDetails.end)
                        return
                    }
                }
            } else {
                timelineClock = null

                if (playingClipId !== activeClip.id) {
                    playingClipId = activeClip.id
                    seekVideo(timelineTimeToMediaMs(
                        [activeClip],
                        nextTime,
                        activeClip.end
                    ))
                    ensureVideoPlaying()
                    publishTimelineTime(nextTime)
                    animationFrameId = requestAnimationFrame(onAnimationFrame)
                    return
                }

                ensureVideoPlaying()
                nextTime = mediaTimeToClipTimelineMs(activeClip, video.currentTime)

                publishTimelineTime(nextTime)

                const { sourceEnd } = getClipSourceRange(activeClip)
                const reachedClipEnd = nextTime >= activeClip.end
                    || video.currentTime * 1000 >= sourceEnd - 1
                if (reachedClipEnd || video.ended) {
                    nextTime = activeClip.end
                    publishTimelineTime(nextTime)
                    playingClipId = null
                    if (nextTime >= videoDetails.end) {
                        stopPlayback(videoDetails.end)
                        return
                    }
                }
            }

            animationFrameId = requestAnimationFrame(onAnimationFrame)
        }

        publishedTimeRef.current = selectTime(store.getState())
        timelineTimeRef.current = publishedTimeRef.current
        animationFrameId = requestAnimationFrame(onAnimationFrame)

        return () => {
            isDisposed = true
            if (animationFrameId !== null) cancelAnimationFrame(animationFrameId)
        }
    }, [
        areVideosReady,
        dispatch,
        isPlaying,
        clips,
        screenVideoRef,
        store,
        videoDetails.end,
        videoDetails.start
    ])

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

    useEffect(() => {
        if (!areVideosReady && isScreenVideoReady &&
            ((hasCameraVideo && isCameraVideoReady)
                || (!hasCameraVideo && hasMicrophoneAudio && isCameraVideoReady)
                || (!hasCameraVideo && !hasMicrophoneAudio))) {
            const activeClip = findActivePlaybackClip(
                clips,
                timelineTimeRef.current,
                videoDetails.end
            )
            if (screenVideoRef.current && activeClip)
                screenVideoRef.current.currentTime = toS(timelineTimeToMediaMs(
                    clips,
                    timelineTimeRef.current,
                    videoDetails.end
                ))
            dispatch(setAreVideosReady(true))
        }
    }, [
        areVideosReady,
        clips,
        dispatch,
        hasCameraVideo,
        hasMicrophoneAudio,
        isCameraVideoReady,
        isScreenVideoReady,
        screenVideoRef,
        videoDetails.end
    ])

    useEffect(() => {
        if (screenVideoRef.current)
            screenVideoRef.current.playbackRate = normalizePlaybackRate(playbackRate)
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
        const activeClip = findActivePlaybackClip(
            clips,
            timelineTimeRef.current,
            videoDetails.end
        )
        if (screenVideoRef.current && activeClip)
            screenVideoRef.current.currentTime = toS(timelineTimeToMediaMs(
                clips,
                timelineTimeRef.current,
                videoDetails.end
            ))
        setIsScreenVideoReady(true)
    }, [clips, screenVideoRef, videoDetails.end])

    const onCameraVideoReady = useCallback(() => {
        setIsCameraVideoReady(true)
    }, [])

    // Added id to bust cache, otherwise chrome doesn't update video when closing / opening project
    return (<div className="absolute -left-[9999px] -top-[9999px] opacity-0 pointer-events-none">
        <TimelineAudioPlayback />
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
                onError={onError}
                mediaRefs={extraVideoRefs}
            />
        ))}
    </div>)
}

VideoWrapper.propTypes = {
    screenVideoRef: PropTypes.object.isRequired,
    cameraVideoRef: PropTypes.object.isRequired,
    extraVideoRefs: PropTypes.object,
}

function ExtraTrackMedia({ index, projectId, onError, mediaRefs }) {
    const src = useVideoSrc(`extra-${index}`, projectId)
    const ref = useRef(null)

    useEffect(() => {
        const mediaElements = mediaRefs?.current
        if (mediaElements) mediaElements[index] = ref.current
        return () => {
            if (mediaElements) mediaElements[index] = null
        }
    }, [index, mediaRefs, src.src])

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
        />
    )
}

ExtraTrackMedia.propTypes = {
    index: PropTypes.number.isRequired,
    projectId: PropTypes.string,
    onError: PropTypes.func,
    mediaRefs: PropTypes.object,
}
