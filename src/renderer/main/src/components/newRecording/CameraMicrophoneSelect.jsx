import {
  ArrowPathIcon
} from "@heroicons/react/24/outline"
import {
  useMutation,
  useQuery,
  useQueryClient
} from "@tanstack/react-query"
import {
  useCallback,
  useEffect
} from "react"
import Button from "../../../../components/Button"
import {
  CONSTRAINTS_AUDIO,
  CONSTRAINTS_VIDEO
} from "../../../../src/helpers"

export default function CameraMicrophoneSelect() {

  const queryClient = useQueryClient()

  const detect = useCallback(async (type, mediaDevices) => {
    const devices = mediaDevices.filter(({ kind }) => kind === `${type}input`)

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
      console.log(e)
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
    staleTime: 0,
    gcTime: 0,
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
    setCameras(null)
    setMicrophones(null)
    queryClient.invalidateQueries({ queryKey: ['devices'] })
  }

  useEffect(() => {
    if (!isPendingMediaDevices &&
      !isPendingCameras &&
      !isPendingDetectCameras &&
      !areDevicesEqual(mediaDevices.filter(({ kind }) => kind === "videoinput"), cameras))
      detectCameras()
  }, [mediaDevices, detectCameras, isPendingDetectCameras, isPendingMediaDevices, cameras, isPendingCameras, areDevicesEqual])

  useEffect(() => {
    if (!isPendingMediaDevices &&
      !isPendingMicrophones &&
      !isPendingDetectMicrophones &&
      !areDevicesEqual(mediaDevices.filter(({ kind }) => kind === "audioinput"), microphones))
      detectMicrophones()
  }, [mediaDevices, microphones, detectMicrophones, isPendingDetectMicrophones, isPendingMediaDevices, isPendingMicrophones, areDevicesEqual])

  const options = (sources, defaultValue) => {
    const options = [<option value="-1" key={0}>{defaultValue}</option>]
    sources?.forEach(
      ({ id, track, label }, i) => options.push(<option value={id} key={i + 1}>{label ?? track.label}</option>))
    return options
  }

  const onSelectCamera = e => setCamera(cameras.find(({ id }) => id === e.target.value)?.id ?? null)

  const onSelectMicrophone = e => setMicrophone(microphones.find(({ id }) => id === e.target.value)?.id ?? null)

  const isPending = isPendingMediaDevices || isPendingCameras || isPendingDetectCameras || isPendingMicrophones ||
    isPendingDetectMicrophones || isPendingCamera || isPendingMicrophone || isPendingSetCamera ||
    isPendingSetMicrophone || isPendingSetCameras || isPendingSetMicrophones

  return (
    <div className="join w-full flex min-w-0">
      <select
        onChange={onSelectCamera}
        disabled={isPending}
        value={camera ?? "-1"}
        className="select join-item flex-1 min-w-0"
      >
        {options(cameras, "No camera")}
      </select>
      <select
        onChange={onSelectMicrophone}
        disabled={isPending}
        value={microphone ?? "-1"}
        className="select join-item flex-1 min-w-0"
      >
        {options(microphones, "No microphone")}
      </select>
      <Button
        onClick={clearCache}
        className="join-item"
        disabled={isPending}
        isLoading={isPending}
        icon={ArrowPathIcon}
      />
    </div>
  )
}