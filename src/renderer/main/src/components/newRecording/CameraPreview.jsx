import { useQuery } from "@tanstack/react-query"
import {
  useEffect,
  useRef
} from "react"
import { useSelector } from "react-redux"
import {
  CONSTRAINTS_AUDIO,
  CONSTRAINTS_VIDEO
} from "../../../../src/helpers"
import { selectIsCloseRequested } from "../../../../src/redux/appSlice"

export default function CameraPreview() {

  const previewVideoRef = useRef(null)

  const isCloseRequested = useSelector(selectIsCloseRequested)

  const { data: cameras, isPending: isPendingCameras } = useQuery({
    queryKey: ['cameras'],
    queryFn: () => window.electron.ipcRenderer.invoke("store-get", "videoSources"),
    staleTime: Infinity
  })

  const { data: microphones, isPending: isPendingMicrophones } = useQuery({
    queryKey: ['microphones'],
    queryFn: async () => window.electron.ipcRenderer.invoke("store-get", "audioSources"),
    staleTime: Infinity
  })

  const { data: camera, isPending: isPendingCamera } = useQuery({
    queryKey: ['camera'],
    queryFn: () => window.electron.ipcRenderer.invoke("store-get", "defaultVideoSource"),
    staleTime: Infinity
  })

  const { data: microphone, isPending: isPendingMicrophone } = useQuery({
    queryKey: ['microphone'],
    queryFn: () => window.electron.ipcRenderer.invoke("store-get", "defaultAudioSource"),
    staleTime: Infinity
  })

  const { data: stream, isPending: isPendingStream } = useQuery({
    queryKey: ['stream', camera, microphone, cameras, microphones],
    queryFn: async () => {
      let video = false
      let videoSource = null
      if (camera) {
        videoSource = cameras.find(({ id }) => id === camera)
        video = { ...CONSTRAINTS_VIDEO, deviceId: videoSource.deviceId }
      }

      let audio = false
      let audioSource = null
      if (microphone) {
        audioSource = microphones.find(({ id }) => id === microphone)
        audio = { ...CONSTRAINTS_AUDIO, deviceId: audioSource.deviceId }
      }

      try {
        const previewStream = await navigator.mediaDevices.getUserMedia({ video, audio })

        if (
          (videoSource &&
            !previewStream
              .getVideoTracks()
              .some((track) => track.label === videoSource.track.label)) ||
          (audioSource &&
            !previewStream
              .getAudioTracks()
              .some((track) => track.label === audioSource.track.label))
        ) {
          const error = new Error("Media track not found")
          error.name = "MediaTrackError"
          throw error
        }

        return previewStream
      } catch (e) {
        if (
          e.name === "NotReadableError" ||
          e.name === "NotFoundError" ||
          e.name === "MediaTrackError" ||
          e.name === "NotAllowedError" ||
          e.name === "PermissionDeniedError"
        ) {
          return null
        } else throw e
      }
    },
    staleTime: 0,
    gcTime: 0,
    retry: false,
    enabled: (!!camera || !!microphone) && !!cameras && !!microphones && !isCloseRequested
  })

  useEffect(() => {
    const el = previewVideoRef.current
    if (!el || !stream) return
    el.srcObject = stream
    return () => {
      el.srcObject = null
      stream?.getTracks().forEach(track => track.stop())
    }
  }, [stream])

  const isPending = isPendingStream || isPendingCameras || isPendingMicrophones || isPendingCamera || isPendingMicrophone

  return (
    <div className={
      `${camera ? "opacity-100 scale-100" : "opacity-0 scale-50"}` +
      " size-28 rounded-3xl overflow-hidden absolute left-5 bottom-5 shadow-xl bg-base-200" +
      " transition-all"} >
      <div className={`${isPending ? "opacity-100" : "opacity-0"}` +
        " w-full h-full flex items-center justify-center transition-opacity absolute left-0 top-0"}>
        <span className="loading loading-spinner"></span>
      </div>
      <video
        ref={previewVideoRef}
        autoPlay
        muted
        className={`${isPending ? "opacity-0" : "opacity-100"}` +
          " object-cover h-full w-full bg-base-100 transition-all absolute left-0 top-0"}
      />
    </div>
  )
}