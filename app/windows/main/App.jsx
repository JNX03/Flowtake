import { useQueryClient } from "@tanstack/react-query"
import {
    lazy,
    Suspense,
    useCallback,
    useEffect,
    useRef,
    useState
} from "react"
import {
    useDispatch,
    useSelector
} from "react-redux"
import {
    openProject,
    TOAST_ERROR,
    TOAST_ERROR_CAPTURE,
    TOAST_EXPORT_COMPLETED,
    TOAST_UPDATE,
    TOAST_WARNING
} from "@shared/helpers"
import {
    addToast,
    selectCapturers,
    selectEncoders,
    selectHasProject,
    setCapturers,
    setEncoders,
    setLoaderMessage
} from "@shared/redux/appSlice"
import { selectTargetScale as selectCameraZoomTargetScale } from "@shared/redux/cameraZoomSlice"
import {
    selectLayout,
    selectMicrophoneAudioVolume,
    selectPlaybackRate,
    selectSystemAudioVolume
} from "@shared/redux/clipSlice"
import {
    selectAlpha,
    selectBorderRadius,
    selectFill,
    selectBlurStrength as selectMaskBlurStrength
} from "@shared/redux/maskSlice"
import {
    selectIsRecording,
    setIsRecording
} from "@shared/redux/recorderSlice"
import {
    selectIntro,
    selectOutro,
    selectBlurStrength as selectZoomBlurStrength,
    selectTargetScale as selectZoomTargetScale
} from "@shared/redux/zoomSlice"
import Launcher from "./components/Launcher"
import Loader from "./components/Loader"
import Toasts from "./components/toasts/Toasts"

// Lazy-load heavy components not needed at startup
const SetupWizard = lazy(() => import("./components/SetupWizard"))
const Editor = lazy(() => import("./components/Editor"))
const Settings = lazy(() => import("./components/settings/Settings"))
const CloseModal = lazy(() => import("./components/CloseModal"))
const PermissionsModal = lazy(() => import("./components/PermissionsModal"))
const ClickMenu = lazy(() => import("./components/contextMenus/ClickMenu"))
const ClipMenu = lazy(() => import("./components/contextMenus/ClipMenu"))
const MaskMenu = lazy(() => import("./components/contextMenus/MaskMenu"))
const NewClipMenu = lazy(() => import("./components/contextMenus/NewClipMenu"))
const NewMaskMenu = lazy(() => import("./components/contextMenus/NewMaskMenu"))
const NewSubtitleMenu = lazy(() => import("./components/contextMenus/NewSubtitleMenu"))
const NewZoomMenu = lazy(() => import("./components/contextMenus/NewZoomMenu"))
const SubtitleMenu = lazy(() => import("./components/contextMenus/SubtitleMenu"))
const ZoomMenu = lazy(() => import("./components/contextMenus/ZoomMenu"))

export default function App() {

    const hasProject = useSelector(selectHasProject)
    const isRecording = useSelector(selectIsRecording)
    const capturers = useSelector(selectCapturers)
    const encoders = useSelector(selectEncoders)
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

    const [showSetupWizard, setShowSetupWizard] = useState(null) // null=loading, true=show, false=hide

    const dispatch = useDispatch()
    const queryClient = useQueryClient()
    const splashDismissed = useRef(false)

    const onSetupComplete = useCallback(async () => {
        await window.electron.ipcRenderer.invoke("store-set", "hasCompletedSetup", true)
        setShowSetupWizard(false)
    }, [])

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

    const dismissSplash = useCallback(() => {
        if (splashDismissed.current) return
        splashDismissed.current = true
        // Defer DOM changes outside React's commit cycle
        setTimeout(() => {
            if (window.splashUpdate) window.splashUpdate('devices')
            if (window.splashDismiss) window.splashDismiss()
        }, 0)
    }, [])

    // Consume early-fetched data from main.jsx (started during splash)
    // This runs immediately on mount - no 100ms delay
    useEffect(() => {
        if (capturers.length > 0 || encoders.length > 0) {
            dismissSplash()
            return
        }

        const consumeEarlyData = async () => {
            try {
                if (window.__earlyData) {
                    const [c, e, setupDone] = await Promise.all([
                        window.__earlyData.capturers,
                        window.__earlyData.encoders,
                        window.__earlyData.setupCompleted
                    ])
                    dispatch(setCapturers(Array.isArray(c) ? c : []))
                    dispatch(setEncoders(Array.isArray(e) ? e : []))
                    setShowSetupWizard(setupDone !== true)
                    window.__earlyData = null
                } else {
                    await getCapturersAndEncoders()
                    const setupDone = await window.electron.ipcRenderer.invoke("store-get", "hasCompletedSetup").catch(() => null)
                    setShowSetupWizard(setupDone !== true)
                }
            } catch (err) {
                console.error("[Flowtake] Early data fetch failed, retrying:", err)
                await getCapturersAndEncoders()
                setShowSetupWizard(false)
            }

            dismissSplash()
        }

        consumeEarlyData()
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    // Fallback: dismiss splash after 4s max (in case device detection hangs)
    useEffect(() => {
        const timeout = setTimeout(dismissSplash, 4000)
        return () => clearTimeout(timeout)
    }, [dismissSplash])

    useEffect(() => {
        // Defer update check to not block startup
        const timer = setTimeout(() => {
            window.electron.ipcRenderer.invoke("check-for-updates")
                .then(info => {
                    if (info?.has_update) {
                        dispatch(addToast({ type: TOAST_UPDATE }))
                    }
                })
                .catch(e => console.warn("[Flowtake] Update check failed:", e))
        }, 2000)

        return () => clearTimeout(timer)
    }, [dispatch])

    useEffect(() => {
        const handleRecordingCanceled = () => dispatch(setIsRecording(false))
        const handleRecordingStopped = () => dispatch(setIsRecording(false))

        window.electron.ipcRenderer.on('recording-canceled', handleRecordingCanceled)
        window.electron.ipcRenderer.on('recording-stopped', handleRecordingStopped)

        return () => {
            window.electron.ipcRenderer.removeListener('recording-canceled', handleRecordingCanceled)
            window.electron.ipcRenderer.removeListener('recording-stopped', handleRecordingStopped)
        }
    }, [dispatch])

    useEffect(() => {
        const handleLoad = (_e, message) => dispatch(setLoaderMessage(message || ''))
        const handleProjectCreated = async (_e, id) => {
            console.log("[Flowtake] project-created event received, id:", id)
            try {
                const actions = await openProject(id, true, layout, microphoneAudioVolume, systemAudioVolume,
                    zoomBlurStrength, cameraZoomtargetScale, playbackRate, maskBlurStrength, maskAlpha, maskBorderRadius,
                    maskFill, intro, outro, zoomTargetScale)
                console.log("[Flowtake] openProject returned", actions.length, "actions")
                actions.forEach(action => dispatch(action))
            } catch (e) {
                console.error("[Flowtake] Project creation error:", e)
                dispatch(addToast({ type: TOAST_ERROR, text: "Failed to open recording: " + (e?.message || String(e)) }))
                dispatch(setLoaderMessage(null))
            }
        }
        const handleRecordingError = async (_e, error) => {
            const errorStr = typeof error === 'string' ? error : error?.message || String(error)
            if (errorStr === "TargetError") dispatch(addToast({ type: TOAST_ERROR, text: "The selected window couldn't be found. Make sure it isn't minimized and try again." }))
            else if (errorStr === "ScreenPermissionDenied") dispatch(addToast({ type: TOAST_ERROR, text: "Screen recording permission denied. Go to System Settings → Privacy & Security → Screen Recording and enable this app." }))
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

    return (
        <div className="h-full relative">
            <div className="h-full overflow-auto">
                {showSetupWizard === true && !hasProject && !isRecording && (
                    <Suspense fallback={null}><SetupWizard onComplete={onSetupComplete} /></Suspense>
                )}
                {showSetupWizard === false && !hasProject && !isRecording && <Launcher />}
                {hasProject && <Suspense fallback={null}><Editor /></Suspense>}
            </div>
            <Loader />
            <Toasts />
            <Suspense fallback={null}>
                <Settings />
                <CloseModal />
                <PermissionsModal />
            </Suspense>
            {hasProject && <Suspense fallback={null}>
                <ClickMenu />
                <ClipMenu />
                <MaskMenu />
                <NewClipMenu />
                <NewMaskMenu />
                <NewSubtitleMenu />
                <NewZoomMenu />
                <SubtitleMenu />
                <ZoomMenu />
            </Suspense>}
        </div>
    )
}
