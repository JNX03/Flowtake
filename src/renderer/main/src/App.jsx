import { useQueryClient } from "@tanstack/react-query"
import {
    useCallback,
    useEffect
} from "react"
import {
    useDispatch,
    useSelector
} from "react-redux"
import {
    openProject,
    TOAST_ERROR,
    TOAST_ERROR_CAPTURE,
    TOAST_EXPIRED_LIFETIME_LICENSE,
    TOAST_EXPIRED_SUBSCRIPTION,
    TOAST_EXPORT_COMPLETED,
    TOAST_LICENSE_ALREADY_USED,
    TOAST_UPDATE,
    TOAST_WARNING
} from "../../src/helpers"
import {
    addToast,
    selectCapturers,
    selectEncoders,
    selectHasProject,
    selectIsReceivingUpdates,
    setCapturers,
    setEncoders,
    setIsReceivingUpdates,
    setLoaderMessage
} from "../../src/redux/appSlice"
import { selectTargetScale as selectCameraZoomTargetScale } from "../../src/redux/cameraZoomSlice"
import {
    selectLayout,
    selectMicrophoneAudioVolume,
    selectPlaybackRate,
    selectSystemAudioVolume
} from "../../src/redux/clipSlice"
import {
    selectHasLicense,
    setEmail,
    setHasLicense,
    setIsChecking
} from "../../src/redux/licenseSlice"
import {
    selectAlpha,
    selectBorderRadius,
    selectFill,
    selectBlurStrength as selectMaskBlurStrength
} from "../../src/redux/maskSlice"
import {
    selectIsRecording,
    setIsRecording
} from "../../src/redux/recorderSlice"
import {
    selectIntro,
    selectOutro,
    selectBlurStrength as selectZoomBlurStrength,
    selectTargetScale as selectZoomTargetScale
} from "../../src/redux/zoomSlice"
import CloseModal from "./components/CloseModal"
import ClickMenu from "./components/contextMenus/ClickMenu"
import ClipMenu from "./components/contextMenus/ClipMenu"
import MaskMenu from "./components/contextMenus/MaskMenu"
import NewClipMenu from "./components/contextMenus/NewClipMenu"
import NewMaskMenu from "./components/contextMenus/NewMaskMenu"
import NewSubtitleMenu from "./components/contextMenus/NewSubtitleMenu"
import NewZoomMenu from "./components/contextMenus/NewZoomMenu"
import SubtitleMenu from "./components/contextMenus/SubtitleMenu"
import ZoomMenu from "./components/contextMenus/ZoomMenu"
import Editor from "./components/Editor"
import Launcher from "./components/Launcher"
import Loader from "./components/Loader"
import PermissionsModal from "./components/PermissionsModal"
import Settings from "./components/settings/settings"
import Toasts from "./components/toasts/Toasts"

export default function App() {

    const hasLicense = useSelector(selectHasLicense)
    const hasProject = useSelector(selectHasProject)
    const isRecording = useSelector(selectIsRecording)
    const capturers = useSelector(selectCapturers)
    const encoders = useSelector(selectEncoders)
    const isReceivingUpdates = useSelector(selectIsReceivingUpdates)
    const layout = useSelector(selectLayout)
    const microphoneAudioVolume = useSelector(selectMicrophoneAudioVolume)
    const systemAudioVolume = useSelector(selectSystemAudioVolume)
    const zoomBlurStrength = useSelector(selectZoomBlurStrength)
    const cameraZoomtargetScale = useSelector(selectCameraZoomTargetScale)
    const playbackRate = useSelector(selectPlaybackRate)
    const maskBlurStrength = useSelector(selectMaskBlurStrength)
    const maskAlpha = useSelector(selectAlpha)
    const maskBorderRadius = useSelector(selectBorderRadius)
    const maskFill = useSelector(selectFill)
    const intro = useSelector(selectIntro)
    const outro = useSelector(selectOutro)
    const zoomTargetScale = useSelector(selectZoomTargetScale)

    const dispatch = useDispatch()
    const queryClient = useQueryClient()

    const getCapturersAndEncoders = useCallback(async () => {
        try {
            const c = await window.electron.ipcRenderer.invoke("get-capturers")
            dispatch(setCapturers(Array.isArray(c) ? c : []))
        } catch (e) {
            console.error("[Flowtake] Failed to get capturers:", e)
            dispatch(setCapturers([]))
        }
        try {
            const e = await window.electron.ipcRenderer.invoke("get-encoders")
            dispatch(setEncoders(Array.isArray(e) ? e : []))
        } catch (e) {
            console.error("[Flowtake] Failed to get encoders:", e)
            dispatch(setEncoders([]))
        }
    }, [dispatch])

    useEffect(() => {
        const handleError = (_e, data) => { dispatch(addToast({ type: TOAST_ERROR, text: data?.message || String(data) })) }
        const handleExportCompleted = (_e, data) => { dispatch(addToast({ type: TOAST_EXPORT_COMPLETED, text: data?.projectName || '' })) }

        window.electron.ipcRenderer.on('error', handleError)
        window.electron.ipcRenderer.on('export-completed', handleExportCompleted)

        return () => {
            window.electron.ipcRenderer.removeListener('error', handleError)
            window.electron.ipcRenderer.removeListener('export-completed', handleExportCompleted)
        }
    }, [dispatch])

    useEffect(() => {
        window.electron.ipcRenderer.once('license', (_e, data) => {
            try {
                const { isValid, message, isReceivingUpdates, email } = data || {}
                dispatch(setHasLicense(isValid ?? true))
                dispatch(setIsChecking(false))
                dispatch(setIsReceivingUpdates(isReceivingUpdates ?? true))
                dispatch(setEmail(email ?? null))
                switch (message) {
                    case "no_network":
                        dispatch(addToast({ type: TOAST_WARNING, text: "Couldn't check license. No internet connection." }))
                        break
                    case "license_already_used":
                        dispatch(addToast({ type: TOAST_LICENSE_ALREADY_USED }))
                        break
                    case "transaction_refunded":
                        dispatch(addToast({ type: TOAST_WARNING, text: "License invalid." }))
                        break
                    case "expired_lifetime_license":
                        dispatch(addToast({ type: TOAST_EXPIRED_LIFETIME_LICENSE }))
                        break
                    case "invalid_version":
                        dispatch(addToast({ type: TOAST_WARNING, text: "Invalid version." }))
                        break
                    case "subscription_expired":
                        dispatch(addToast({ type: TOAST_EXPIRED_SUBSCRIPTION }))
                        break
                    default:
                        break
                }
            } catch (e) {
                console.error("[Flowtake] License handling error:", e)
                dispatch(setHasLicense(true))
                dispatch(setIsChecking(false))
                dispatch(setIsReceivingUpdates(true))
            }
        })
        dispatch(setIsChecking(true))
        window.electron.ipcRenderer.invoke("get-license").catch(e => {
            console.error("[Flowtake] get-license error:", e)
            dispatch(setHasLicense(true))
            dispatch(setIsChecking(false))
            dispatch(setIsReceivingUpdates(true))
        })
    }, [dispatch])

    useEffect(() => {
        if (capturers.length === 0 && encoders.length === 0) getCapturersAndEncoders()
    }, [capturers.length, encoders.length, getCapturersAndEncoders])

    useEffect(() => {
        if (hasLicense && isReceivingUpdates) {
            const handleUpdateDownloaded = () => { dispatch(addToast({ type: TOAST_UPDATE })) }

            window.electron.ipcRenderer.on('update-downloaded', handleUpdateDownloaded)
            window.electron.ipcRenderer.invoke("check-for-updates").catch(e => console.warn("[Flowtake] Update check failed:", e))

            return () => {
                window.electron.ipcRenderer.removeListener('update-downloaded', handleUpdateDownloaded)
            }
        }
    }, [dispatch, hasLicense, isReceivingUpdates])

    useEffect(() => {
        const handleRecordingCanceled = () => dispatch(setIsRecording(false))

        window.electron.ipcRenderer.on('recording-canceled', handleRecordingCanceled)

        return () => {
            window.electron.ipcRenderer.removeListener('recording-canceled', handleRecordingCanceled)
        }
    }, [dispatch])

    useEffect(() => {
        const handleLoad = (_e, message) => dispatch(setLoaderMessage(message || ''))
        const handleProjectCreated = async (_e, id) => {
            try {
                const actions = await openProject(id, true, layout, microphoneAudioVolume, systemAudioVolume,
                    zoomBlurStrength, cameraZoomtargetScale, playbackRate, maskBlurStrength, maskAlpha, maskBorderRadius,
                    maskFill, intro, outro, zoomTargetScale)
                actions.forEach(action => dispatch(action))
            } catch (e) {
                console.error("[Flowtake] Project creation error:", e)
            }
        }
        const handleRecordingError = async (_e, error) => {
            const errorStr = typeof error === 'string' ? error : error?.message || String(error)
            if (errorStr === "TargetError") dispatch(addToast({ type: TOAST_ERROR, text: "The selected window couldn't be found. Make sure it isn't minimized and try again." }))
            else if (errorStr === "CaptureError") dispatch(addToast({ type: TOAST_ERROR_CAPTURE }))
            else dispatch(addToast({ type: TOAST_ERROR, text: errorStr }))

            dispatch(setIsRecording(false))
        }

        window.electron.ipcRenderer.on('load', handleLoad)
        window.electron.ipcRenderer.on('project-created', handleProjectCreated)
        window.electron.ipcRenderer.on('recording-error', handleRecordingError)

        return () => {
            window.electron.ipcRenderer.removeListener('load', handleLoad)
            window.electron.ipcRenderer.removeListener('project-created', handleProjectCreated)
            window.electron.ipcRenderer.removeListener('recording-error', handleRecordingError)
        }
    }, [dispatch, layout, zoomBlurStrength, cameraZoomtargetScale, playbackRate, maskBlurStrength, maskAlpha,
        maskBorderRadius, maskFill, intro, outro, zoomTargetScale, microphoneAudioVolume, systemAudioVolume])

    useEffect(() => {
        if (!hasProject) queryClient.invalidateQueries()
    }, [hasProject, queryClient])

    return (<>
        <div className="h-full overflow-auto">
            {!hasProject && !isRecording && <Launcher />}
            {hasProject && <Editor />}
        </div>
        <Loader />
        <Toasts />
        <Settings />
        <CloseModal />
        <PermissionsModal />
        {hasProject && <>
            <ClickMenu />
            <ClipMenu />
            <MaskMenu />
            <NewClipMenu />
            <NewMaskMenu />
            <NewSubtitleMenu />
            <NewZoomMenu />
            <SubtitleMenu />
            <ZoomMenu />
        </>}
    </>)
}