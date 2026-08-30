import {
  ArrowPathIcon,
  VideoCameraIcon,
  MicrophoneIcon,
} from "@heroicons/react/24/outline"
import {
  useMutation,
  useQuery,
  useQueryClient
} from "@tanstack/react-query"
import {
  useCallback,
  useState
} from "react"
import PropTypes from "prop-types"
import {
  CONSTRAINTS_AUDIO
} from "@shared/helpers"

const canonicalMediaDevices = (devices, excludedLabel = null) => (devices || [])
  .filter(device => device.kind === "videoinput" || device.kind === "audioinput")
  .filter(device => device.deviceId !== "default" && device.deviceId !== "communications")
  .filter(device => !excludedLabel || device.label !== excludedLabel)

const DETECT_CAMERA_VALUE = "__detect-camera__"
const DETECT_MICROPHONE_VALUE = "__detect-microphone__"

export default function CameraMicrophoneSelect({ audioProcessingSettings }) {

  const queryClient = useQueryClient()
  const [permissionDenied, setPermissionDenied] = useState({ video: false, audio: false })

  const detect = useCallback(async (type, excludedLabel = null) => {
    try {
      // One lightweight permission probe unlocks labels for every device. Opening
      // every camera and microphone serially made the launcher slow and glitchy.
      const permissionStream = await navigator.mediaDevices.getUserMedia({
        video: type === "video",
        audio: type === "audio" ? { ...CONSTRAINTS_AUDIO, ...audioProcessingSettings } : false,
      })
      permissionStream.getTracks().forEach(track => track.stop())

      const refreshedDevices = await navigator.mediaDevices.enumerateDevices()
      const configs = canonicalMediaDevices(refreshedDevices, excludedLabel)
        .filter(device => device.kind === `${type}input`)
        .map(device => ({
          id: `mediaSource-${device.deviceId || device.groupId || device.label}`,
          track: { label: device.label },
          deviceId: device.deviceId,
          label: device.label || `${type === "video" ? "Camera" : "Microphone"} ${device.deviceId.slice(0, 6)}`,
        }))

      setPermissionDenied(prev => ({ ...prev, [type]: false }))
      return configs
    } catch (e) {
      // If permission was denied or device not available, mark it and stop retrying
      if (e.name === "NotAllowedError" || e.name === "PermissionDeniedError") {
        setPermissionDenied(prev => ({ ...prev, [type]: true }))
        return []
      }
      console.log(e)
      return []
    }
  }, [audioProcessingSettings])

  const { data: systemAudio, isPending: isPendingSystemAudio } = useQuery({
    queryKey: ['systemAudio'],
    queryFn: () => window.electron.ipcRenderer.invoke("store-get", "defaultSystemAudioSource"),
    staleTime: Infinity
  })

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

  const { mutate: detectCameras, isPending: isPendingDetectCameras } = useMutation({
    mutationFn: async ({ selectFirst = false } = {}) => {
      const cameras = await detect("video")
      await window.electron.ipcRenderer.invoke("store-set", "videoSources", cameras)
      const nextSelection = cameras.some(device => device.id === camera)
        ? camera
        : selectFirst ? cameras[0]?.id ?? null : null
      await window.electron.ipcRenderer.invoke("store-set", "defaultVideoSource", nextSelection)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cameras'] })
      queryClient.invalidateQueries({ queryKey: ['camera'] })
    },
  })

  const { mutate: detectMicrophones, isPending: isPendingDetectMicrophones } = useMutation({
    mutationFn: async ({ selectFirst = false } = {}) => {
      const microphones = await detect("audio", systemAudio)
      await window.electron.ipcRenderer.invoke("store-set", "audioSources", microphones)
      const nextSelection = microphones.some(device => device.id === microphone)
        ? microphone
        : selectFirst ? microphones[0]?.id ?? null : null
      await window.electron.ipcRenderer.invoke("store-set", "defaultAudioSource", nextSelection)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['microphones'] })
      queryClient.invalidateQueries({ queryKey: ['microphone'] })
    },
  })

  const { mutate: setCamera, isPending: isPendingSetCamera } = useMutation({
    mutationFn: camera => window.electron.ipcRenderer.invoke("store-set", "defaultVideoSource", camera),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['camera'] })
    },
  })

  const { mutate: setMicrophone, isPending: isPendingSetMicrophone } = useMutation({
    mutationFn: microphone => window.electron.ipcRenderer.invoke("store-set", "defaultAudioSource", microphone),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['microphone'] })
    },
  })

  const refreshDevices = () => {
    setPermissionDenied({ video: false, audio: false })
    detectCameras()
    detectMicrophones()
  }

  const options = (sources, defaultValue, detectValue, detectLabel) => {
    const options = [<option value="-1" key={0}>{defaultValue}</option>]
    sources?.forEach(
      ({ id, track, label }, i) => options.push(<option value={id} key={i + 1}>{label || track?.label}</option>))
    options.push(<option value={detectValue} key={detectValue}>{detectLabel}</option>)
    return options
  }

  const onSelectCamera = e => {
    if (e.target.value === DETECT_CAMERA_VALUE) {
      detectCameras({ selectFirst: true })
      return
    }
    setCamera((cameras ?? []).find(({ id }) => id === e.target.value)?.id ?? null)
  }

  const onSelectMicrophone = e => {
    if (e.target.value === DETECT_MICROPHONE_VALUE) {
      detectMicrophones({ selectFirst: true })
      return
    }
    setMicrophone((microphones ?? []).find(({ id }) => id === e.target.value)?.id ?? null)
  }

  const isPending = isPendingSystemAudio || isPendingCameras || isPendingDetectCameras || isPendingMicrophones ||
    isPendingDetectMicrophones || isPendingCamera || isPendingMicrophone || isPendingSetCamera ||
    isPendingSetMicrophone

  const hasAnyDenied = permissionDenied.video || permissionDenied.audio

  return (
    <div className="flex flex-col gap-2 w-full">
      {/* Camera row */}
      <div className="flex items-center gap-2">
        <div className={`size-7 rounded-lg flex items-center justify-center flex-shrink-0 ${permissionDenied.video ? "bg-error/10 text-error/60" : "bg-base-content/5 text-base-content/40"}`}>
          <VideoCameraIcon className="size-3.5" />
        </div>
        <select
          aria-label="Camera"
          onChange={onSelectCamera}
          disabled={isPending || permissionDenied.video}
          value={camera ?? "-1"}
          className={`select select-sm flex-1 min-w-0 bg-transparent border-base-content/8 focus:border-primary/30 text-xs ${permissionDenied.video ? "select-error" : ""}`}
        >
          {permissionDenied.video
            ? <option value="-1">Camera not available</option>
            : options(cameras, "Camera off", DETECT_CAMERA_VALUE, "Turn on a camera...")}
        </select>
      </div>

      {/* Microphone row */}
      <div className="flex items-center gap-2">
        <div className={`relative size-7 rounded-lg flex items-center justify-center flex-shrink-0 ${permissionDenied.audio ? "bg-error/10 text-error/60" : "bg-base-content/5 text-base-content/40"}`}>
          <MicrophoneIcon className="size-3.5" />
          {microphone && !permissionDenied.audio && (
            <div className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-emerald-500 ring-1 ring-base-100" />
          )}
        </div>
        <div className="flex-1 min-w-0 flex flex-col gap-1">
          <select
            aria-label="Microphone"
            onChange={onSelectMicrophone}
            disabled={isPending || permissionDenied.audio}
            value={microphone ?? "-1"}
            className={`select select-sm w-full bg-transparent border-base-content/8 focus:border-primary/30 text-xs ${permissionDenied.audio ? "select-error" : ""}`}
          >
            {permissionDenied.audio
              ? <option value="-1">Mic not available</option>
              : options(microphones, "Microphone off", DETECT_MICROPHONE_VALUE, "Turn on a microphone...")}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-0.5">
        <div className="size-7 flex-shrink-0" />
        <p className={`text-[11px] flex-1 ${hasAnyDenied ? "text-warning" : "text-base-content/40"}`}>
          {hasAnyDenied ? "Permission denied" : "Camera and mic stay off until you choose one."}
        </p>
        <button
          type="button"
          aria-label={hasAnyDenied ? "Retry device detection" : "Refresh cameras and microphones"}
          onClick={refreshDevices}
          disabled={isPending}
          className="btn btn-ghost btn-xs gap-1 text-base-content/40 hover:text-base-content/70 ml-auto"
        >
          <ArrowPathIcon className={`size-3 ${isPending ? "animate-spin" : ""}`} />
          <span className="text-[11px]">{hasAnyDenied ? "Retry" : "Refresh"}</span>
        </button>
      </div>
    </div>
  )
}

CameraMicrophoneSelect.propTypes = {
  audioProcessingSettings: PropTypes.shape({
    noiseSuppression: PropTypes.bool,
    echoCancellation: PropTypes.bool,
    autoGainControl: PropTypes.bool,
  }).isRequired,
}
