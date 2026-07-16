import { SignalIcon } from "@heroicons/react/24/outline"
import { useQuery } from "@tanstack/react-query"
import PropTypes from "prop-types"
import { useCallback, useState } from "react"
import { useDispatch, useSelector } from "react-redux"
import Button from "../../../../components/Button"
import {
    CONSTRAINTS_AUDIO,
    CONSTRAINTS_VIDEO
} from "@shared/helpers"
import {
    selectCapturers,
    selectEncoders,
} from "@shared/redux/appSlice"
import {
    selectIsRecording,
    selectSource,
    setIsRecording
} from "@shared/redux/recorderSlice"
import { loadLiveSettings } from "../settings/liveSettingsStore"

export default function GoLiveButton({ isRecordingSystemAudio, excludedAudioPids = [] }) {

    const dispatch = useDispatch()
    const [isStarting, setIsStarting] = useState(false)

    const source = useSelector(selectSource)
    const isRecording = useSelector(selectIsRecording)
    const capturers = useSelector(selectCapturers)
    const encoders = useSelector(selectEncoders)

    const { data: camera, isPending: isPendingCamera } = useQuery({
        queryKey: ['camera'],
        queryFn: () => window.electron.ipcRenderer.invoke("store-get", "defaultVideoSource"),
        staleTime: Infinity
    })
    const { data: cameras, isPending: isPendingCameras } = useQuery({
        queryKey: ['cameras'],
        queryFn: () => window.electron.ipcRenderer.invoke("store-get", "videoSources"),
        staleTime: Infinity
    })
    const { data: microphone, isPending: isPendingMicrophone } = useQuery({
        queryKey: ['microphone'],
        queryFn: () => window.electron.ipcRenderer.invoke("store-get", "defaultAudioSource"),
        staleTime: Infinity
    })
    const { data: microphones, isPending: isPendingMicrophones } = useQuery({
        queryKey: ['microphones'],
        queryFn: () => window.electron.ipcRenderer.invoke("store-get", "audioSources"),
        staleTime: Infinity
    })
    const { data: systemAudio, isPending: isPendingSystemAudio } = useQuery({
        queryKey: ['systemAudio'],
        queryFn: () => window.electron.ipcRenderer.invoke("store-get", "defaultSystemAudioSource"),
        staleTime: Infinity
    })
    const { data: liveSettings, isPending: isPendingLive } = useQuery({
        queryKey: ['liveSettings'],
        queryFn: loadLiveSettings,
        staleTime: Infinity,
    })

    const hasStreamKey = Boolean(liveSettings?.hasStreamKey)
    const hasRtmp = !!(liveSettings?.rtmpUrl && liveSettings.rtmpUrl.trim().length > 0)
    const isConfigured = hasRtmp && hasStreamKey

    const onClick = useCallback(async () => {
        if (isStarting || isRecording) return
        if (!isConfigured) return

        setIsStarting(true)
        const video = (cameras ?? []).find(({ id }) => id === camera) ?? null
        const audio = (microphones ?? []).find(({ id }) => id === microphone) ?? null

        const mediaSourceConfig = {
            videoTrack: video?.track.label,
            audioTrack: audio?.track.label,
            constraints: {
                video: video
                    ? { ...CONSTRAINTS_VIDEO, deviceId: video.deviceId }
                    : false,
                audio: audio
                    ? { ...CONSTRAINTS_AUDIO, deviceId: audio.deviceId }
                    : false,
            },
        }

        try {
            await window.electron.ipcRenderer.invoke(
                "init-recording",
                source,
                mediaSourceConfig,
                isRecordingSystemAudio ? systemAudio : null,
                "live",
            )
            if (isRecordingSystemAudio && excludedAudioPids.length > 0) {
                window.electron.ipcRenderer.invoke("mute-audio-sessions", excludedAudioPids)
            }
            dispatch(setIsRecording(true))
        } catch (err) {
            console.error("[Flowtake] go-live failed:", err)
            dispatch(setIsRecording(false))
        } finally {
            setIsStarting(false)
        }
    }, [isStarting, isRecording, isConfigured, cameras, microphones, source, isRecordingSystemAudio, systemAudio, dispatch, camera, microphone, excludedAudioPids])

    const isPending = isPendingCamera || isPendingCameras || isPendingMicrophone || isPendingMicrophones ||
        isPendingSystemAudio || isPendingLive

    const tooltip = !isConfigured && !isPending
        ? (hasRtmp ? "Add your stream key in destination settings" : "Set the RTMP destination first")
        : undefined

    return (
        <Button
            onClick={onClick}
            isLoading={isStarting || isPending || !capturers?.length || !encoders?.length}
            disabled={isStarting || isPending || !capturers?.length || !encoders?.length || !isConfigured}
            icon={SignalIcon}
            tooltip={tooltip}
            className="btn-error w-full"
        >
            Go Live
        </Button>
    )
}

GoLiveButton.propTypes = {
    isRecordingSystemAudio: PropTypes.bool.isRequired,
    excludedAudioPids: PropTypes.arrayOf(PropTypes.number),
}
