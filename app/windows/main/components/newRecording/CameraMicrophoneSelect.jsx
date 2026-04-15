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
  useEffect,
  useRef,
  useState
} from "react"
import {
  CONSTRAINTS_AUDIO,
  CONSTRAINTS_VIDEO
} from "@shared/helpers"
import useAudioMeter from "@shared/hooks/useAudioMeter"
import VolumeMeter from "../../../../components/VolumeMeter"

export default function CameraMicrophoneSelect() {

  const queryClient = useQueryClient()
  const [permissionDenied, setPermissionDenied] = useState({ video: false, audio: false })
  const [meterStream, setMeterStream] = useState(null)
  const meterStreamRef = useRef(null)
  const { level, peak } = useAudioMeter(meterStream)

  const detect = useCallback(async (type, mediaDevices) => {
    const devices = (mediaDevices || []).filter(({ kind }) => kind === `${type}input`)

    const configs = []

    try {
      for (const device of devices) {
        const constraints = {
          video: type === "video" ? { ...CONSTRAINTS_VIDEO, deviceId: device.deviceId } : false,
          audio: type === "audio" ? { ...CONSTRAINTS_AUDIO, deviceId: device.deviceId } : false
        }

        const stream = await navigator.mediaDevices.getUserMedia(constraints)
        if (!stream) continue

        let tracks

        switch (type) {
          case "video":
            tracks = stream.getVideoTracks()
            break
          case "audio":
            tracks = stream.getAudioTracks()
            break
        }

        for (const track of tracks) {
          configs.push({
            id: `mediaSource-${self.crypto.randomUUID()}`,
            track,
            deviceId: device.deviceId,
            label:
              tracks.length > 1
                ? `${device.label} (${track.label})`
                : device.label,
          })
        }
        stream.getTracks().forEach(track => track.stop())
      }
    } catch (e) {
      // If permission was denied or device not available, mark it and stop retrying
      if (e.name === "NotAllowedError" || e.name === "PermissionDeniedError") {
        setPermissionDenied(prev => ({ ...prev, [type]: true }))
        return configs
      }
      console.log(e)
    }

    // Clear denied state on success
    if (configs.length > 0) {
      setPermissionDenied(prev => ({ ...prev, [type]: false }))
    }

    return configs
      .filter(({ track }) => track.kind === type)
      .map(({ id, track, deviceId, label }) => ({
        id,
        track: { label: track.label },
        deviceId,
        label,
      }))
  }, [])

  const areDevicesEqual = useCallback((a, b) => {
    if (!a || !b || a.length !== b.length) return false
    return a.every(deviceFromA =>
      b.some(deviceFromB =>
        deviceFromB.label === deviceFromA.label && deviceFromB.deviceId === deviceFromA.deviceId))
  }, [])

  const { data: systemAudio, isPending: isPendingSystemAudio } = useQuery({
    queryKey: ['systemAudio'],
    queryFn: () => window.electron.ipcRenderer.invoke("store-get", "defaultSystemAudioSource"),
    staleTime: Infinity
  })

  const { data: mediaDevices, isPending: isPendingMediaDevices } = useQuery({
    queryKey: ['devices', systemAudio],
    queryFn: async () => {
      const devices = await navigator.mediaDevices.enumerateDevices()
      return devices
        .filter(({ kind }) => kind === "videoinput" || kind === "audioinput")
        .filter(({ deviceId }) => deviceId !== "default" && deviceId !== "communications")
        .filter(({ label }) => label !== systemAudio)
    },
    staleTime: 5000,
    gcTime: 10000,
    enabled: !isPendingSystemAudio
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
    mutationFn: async () => {
      const cameras = await detect("video", mediaDevices)
      await window.electron.ipcRenderer.invoke("store-set", "videoSources", cameras)
      await window.electron.ipcRenderer.invoke("store-set", "defaultVideoSource", null)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cameras'] })
      queryClient.invalidateQueries({ queryKey: ['camera'] })
    },
  })

  const { mutate: detectMicrophones, isPending: isPendingDetectMicrophones } = useMutation({
    mutationFn: async () => {
      const microphones = await detect("audio", mediaDevices)
      await window.electron.ipcRenderer.invoke("store-set", "audioSources", microphones)
      await window.electron.ipcRenderer.invoke("store-set", "defaultAudioSource", null)
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

  const { mutate: setCameras, isPending: isPendingSetCameras } = useMutation({
    mutationFn: cameras => window.electron.ipcRenderer.invoke("store-set", "videoSources", cameras),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cameras'] })
    },
  })

  const { mutate: setMicrophones, isPending: isPendingSetMicrophones } = useMutation({
    mutationFn: microphones => window.electron.ipcRenderer.invoke("store-set", "audioSources", microphones),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['microphones'] })
    },
  })

  const clearCache = () => {
    setPermissionDenied({ video: false, audio: false })
    setCameras(null)
    setMicrophones(null)
    queryClient.invalidateQueries({ queryKey: ['devices'] })
  }

  useEffect(() => {
    if (!isPendingMediaDevices &&
      !isPendingCameras &&
      !isPendingDetectCameras &&
      !permissionDenied.video &&
      mediaDevices &&
      !areDevicesEqual(mediaDevices.filter(({ kind }) => kind === "videoinput"), cameras))
      detectCameras()
  }, [mediaDevices, detectCameras, isPendingDetectCameras, isPendingMediaDevices, cameras, isPendingCameras, areDevicesEqual, permissionDenied.video])

  useEffect(() => {
    if (!isPendingMediaDevices &&
      !isPendingMicrophones &&
      !isPendingDetectMicrophones &&
      !permissionDenied.audio &&
      mediaDevices &&
      !areDevicesEqual(mediaDevices.filter(({ kind }) => kind === "audioinput"), microphones))
      detectMicrophones()
  }, [mediaDevices, microphones, detectMicrophones, isPendingDetectMicrophones, isPendingMediaDevices, isPendingMicrophones, areDevicesEqual, permissionDenied.audio])

  // Acquire a metering-only audio stream when a microphone is selected
  useEffect(() => {
    if (!microphone || !microphones || permissionDenied.audio) {
      if (meterStreamRef.current) {
        meterStreamRef.current.getTracks().forEach(t => t.stop())
        meterStreamRef.current = null
      }
      setMeterStream(null)
      return
    }
    const selected = microphones.find(({ id }) => id === microphone)
    if (!selected) return

    let cancelled = false
    navigator.mediaDevices.getUserMedia({
      video: false,
      audio: { ...CONSTRAINTS_AUDIO, deviceId: selected.deviceId }
    }).then(stream => {
      if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }
      if (meterStreamRef.current) meterStreamRef.current.getTracks().forEach(t => t.stop())
      meterStreamRef.current = stream
      setMeterStream(stream)
    }).catch(() => {})

    return () => {
      cancelled = true
      if (meterStreamRef.current) {
        meterStreamRef.current.getTracks().forEach(t => t.stop())
        meterStreamRef.current = null
      }
      setMeterStream(null)
    }
  }, [microphone, microphones, permissionDenied.audio])

  const options = (sources, defaultValue) => {
    const options = [<option value="-1" key={0}>{defaultValue}</option>]
    sources?.forEach(
      ({ id, track, label }, i) => options.push(<option value={id} key={i + 1}>{label ?? track.label}</option>))
    return options
  }

  const onSelectCamera = e => setCamera((cameras ?? []).find(({ id }) => id === e.target.value)?.id ?? null)

  const onSelectMicrophone = e => setMicrophone((microphones ?? []).find(({ id }) => id === e.target.value)?.id ?? null)

  const isPending = isPendingMediaDevices || isPendingCameras || isPendingDetectCameras || isPendingMicrophones ||
    isPendingDetectMicrophones || isPendingCamera || isPendingMicrophone || isPendingSetCamera ||
    isPendingSetMicrophone || isPendingSetCameras || isPendingSetMicrophones

  const hasAnyDenied = permissionDenied.video || permissionDenied.audio

  return (
    <div className="flex flex-col gap-2 w-full">
      {/* Camera row */}
      <div className="flex items-center gap-2">
        <div className={`size-7 rounded-lg flex items-center justify-center flex-shrink-0 ${permissionDenied.video ? "bg-error/10 text-error/60" : "bg-base-content/5 text-base-content/40"}`}>
          <VideoCameraIcon className="size-3.5" />
        </div>
        <select
          onChange={onSelectCamera}
          disabled={isPending || permissionDenied.video}
          value={camera ?? "-1"}
          className={`select select-sm flex-1 min-w-0 bg-transparent border-base-content/8 focus:border-primary/30 text-xs ${permissionDenied.video ? "select-error" : ""}`}
        >
          {permissionDenied.video
            ? <option value="-1">Camera not available</option>
            : options(cameras, "No camera")}
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
            onChange={onSelectMicrophone}
            disabled={isPending || permissionDenied.audio}
            value={microphone ?? "-1"}
            className={`select select-sm w-full bg-transparent border-base-content/8 focus:border-primary/30 text-xs ${permissionDenied.audio ? "select-error" : ""}`}
          >
            {permissionDenied.audio
              ? <option value="-1">Mic not available</option>
              : options(microphones, "No microphone")}
          </select>
          {microphone && !permissionDenied.audio && (
            <VolumeMeter level={level} peak={peak} showPeak />
          )}
        </div>
      </div>

      {/* Refresh / Permission denied */}
      {(hasAnyDenied || isPending) && (
        <div className="flex items-center gap-2 mt-0.5">
          <div className="size-7 flex-shrink-0" />
          {hasAnyDenied && (
            <p className="text-[11px] text-warning flex-1">Permission denied</p>
          )}
          <button
            onClick={clearCache}
            disabled={isPending}
            className="btn btn-ghost btn-xs gap-1 text-base-content/40 hover:text-base-content/70"
          >
            <ArrowPathIcon className={`size-3 ${isPending ? "animate-spin" : ""}`} />
            <span className="text-[11px]">{hasAnyDenied ? "Retry" : "Refresh"}</span>
          </button>
        </div>
      )}
    </div>
  )
}
