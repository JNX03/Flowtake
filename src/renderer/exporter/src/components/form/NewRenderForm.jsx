import {
    QueueListIcon,
    XMarkIcon
} from "@heroicons/react/24/outline"
import {
    useMutation,
    useQuery,
    useQueryClient
} from "@tanstack/react-query"
import PropTypes from "prop-types"
import {
    useCallback,
    useEffect,
    useMemo,
    useState
} from "react"
import {
    useDispatch,
    useSelector
} from "react-redux"
import Button from "../../../../components/Button"
import Toggle from "../../../../main/src/components/properties/Toggle"
import {
    getRenderQualityLabel,
    RENDER_PENDING,
    TOAST_ERROR
} from "../../../../src/helpers"
import {
    addRender,
    addToast,
    selectProjectState,
    setProjectState
} from "../../../../src/redux/renderSlice"
import { captureException } from "../../../../src/sentryHelpers"
import ShareableUrl from "./ShareableUrl"

export default function Form({ onAdd, onCancel, isVisible }) {

    const dispatch = useDispatch()
    const queryClient = useQueryClient()

    const [aspectRatio, setAspectRatio] = useState("16x9")
    const [useShareableUrl, setUseShareableUrl] = useState(false)
    const [presignedUrl, setPresignedUrl] = useState(null)
    const [objectId, setObjectId] = useState(null)
    const [isInitializing, setIsInitializing] = useState(false)

    const projectState = useSelector(selectProjectState)

    const { data: fps, isPending: isPendingFps } = useQuery({
        queryKey: ['defaultExportFps'],
        queryFn: () => window.electron.ipcRenderer.invoke("store-get", "defaultExportFps"),
        staleTime: Infinity
    })

    const { mutate: setFps, isPending: isPendingSetFps } = useMutation({
        mutationFn: fps => window.electron.ipcRenderer.invoke("store-set", "defaultExportFps", fps),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['defaultExportFps'] }),
    })

    const { data: quality, isPending: isPendingQuality } = useQuery({
        queryKey: ['defaultExportQuality'],
        queryFn: () => window.electron.ipcRenderer.invoke("store-get", "defaultExportQuality"),
        staleTime: Infinity
    })

    const { mutate: setQuality, isPending: isPendingSetQuality } = useMutation({
        mutationFn: quality => window.electron.ipcRenderer.invoke("store-set", "defaultExportQuality", quality),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['defaultExportQuality'] }),
    })

    const { data: resolutionString, isPending: isPendingResolutionString } = useQuery({
        queryKey: ['defaultExportResolution', aspectRatio],
        queryFn: () => window.electron.ipcRenderer.invoke("store-get", `defaultExportResolution.${aspectRatio}`),
        staleTime: Infinity,
        enabled: !!aspectRatio
    })

    const { mutate: setResolutionString, isPending: isPendingSetResolutionString } = useMutation({
        mutationFn: resolution =>
            window.electron.ipcRenderer.invoke("store-set", `defaultExportResolution.${aspectRatio}`, resolution),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['defaultExportResolution', aspectRatio] }),
    })

    const resolutions = useMemo(() => {
        switch (aspectRatio) {
            case "16x9":
                return ["3840x2160", "1920x1080", "1280x720", "854x480"]
            case "9x16":
                return ["2160x3840", "1080x1920", "720x1280", "480x854"]
            case "1x1":
                return ["2160x2160", "1080x1080", "720x720", "480x480"]
            default:
                return ["3840x2160", "1920x1080", "1280x720", "854x480"]
        }
    }, [aspectRatio])

    const getUrl = useCallback(async () => {
        const { id, presignedUrl } = await window.electron.ipcRenderer.invoke(
            "get-shareable-url",
            projectState.undoableState.present.project.name
        )
        if (id && presignedUrl) {
            setObjectId(id)
            setPresignedUrl(presignedUrl)
        } else setUseShareableUrl(false)
    }, [projectState])

    useEffect(() => {
        if (projectState) setAspectRatio(projectState.undoableState.present.project.aspectRatio)
    }, [projectState])

    useEffect(() => {
        if (!projectState) window.electron.ipcRenderer.invoke("get-project-state")
    }, [projectState])

    useEffect(() => {
        window.electron.ipcRenderer.on('project-state', (_e, state) => dispatch(setProjectState(state)))
    }, [dispatch])

    useEffect(() => {
        if (useShareableUrl && !objectId) getUrl()
    }, [useShareableUrl, objectId, getUrl])

    useEffect(() => {
        if (isVisible) {
            setUseShareableUrl(false)
            setPresignedUrl(null)
            setObjectId(null)
        }
    }, [isVisible])

    useEffect(() => {
        if (useShareableUrl && quality === "very_high") setQuality("high")
    }, [quality, setQuality, useShareableUrl])

    const onResolutionChange = event => setResolutionString(event.target.value)

    const onAspectRatioChange = event => setAspectRatio(event.target.value)

    const onFPSChange = event => setFps(Number(event.target.value))

    const onQualityChange = event => setQuality(event.target.value)

    const onAddClicked = async () => {
        setIsInitializing(true)
        const state = structuredClone(projectState)

        const [x, y] = resolutionString.split("x")
        const resolution = { x: Number(x), y: Number(y) }

        state.animator.rendererDims = resolution
        delete state.undoableState.past
        delete state.undoableState.future
        const render = {
            state,
            status: RENDER_PENDING,
            config: { resolution, fps, aspectRatio, quality },
            upload: { isRequested: useShareableUrl && !!presignedUrl, presignedUrl, objectId },
            timestamp: Date.now(),
            id: `render-${self.crypto.randomUUID()}`
        }
        try {
            await window.electron.ipcRenderer.invoke("queue-render", render)
            dispatch(addRender(render))
            onAdd()
        } catch (e) {
            dispatch(addToast({ type: TOAST_ERROR, text: "Couldn't queue render" }))
            captureException(e)
        } finally {
            setIsInitializing(false)
        }
    }

    const isShareableUrlEnabled = () => {
        if (projectState === null) return false
        const { start, end } = projectState.undoableState.present.project.videoDetails
        return end - start <= 10 * 60 * 1000    // 10 minutes
    }

    return (
        <div className={`flex justify-center items-center h-full ${isVisible ? "" : "hidden"}`}>
            <div className="max-w-sm grid grid-cols-1 gap-2">
                <fieldset className="fieldset bg-base-100 border border-base-200 px-4 pb-4 rounded-box">
                    <legend className="fieldset-legend">Render Configuration</legend>
                    <span className="mb-4">
                        Lower resolution and frame rate for faster exports. Lower quality for smaller video file.
                        Quality doesn&apos;t affect export speed.
                    </span>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="label">Aspect Ratio</label>
                            <select onChange={onAspectRatioChange} value={aspectRatio} className="select">
                                <option value="16x9">16:9</option>
                                <option value="9x16">9:16</option>
                                <option value="1x1">Square</option>
                            </select>
                        </div>
                        <div>
                            <label className="label">Resolution</label>
                            <select onChange={onResolutionChange} value={resolutionString} className="select"
                                disabled={isPendingSetResolutionString || isPendingResolutionString}>
                                {resolutions.map((res, i) => <option disabled={useShareableUrl && (res === "3840x2160" || res === "2160x3840" || res === "2160x2160")} key={`res-${i}`} value={res}>{res}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="label">Frame Rate</label>
                            <select onChange={onFPSChange} value={fps} className="select"
                                disabled={isPendingSetFps || isPendingFps}>
                                <option value={60}>60 FPS</option>
                                <option value={30}>30 FPS</option>
                            </select>
                        </div>
                        <div>
                            <label className="label">Quality</label>
                            <select onChange={onQualityChange} value={quality} className="select"
                                disabled={isPendingSetQuality || isPendingQuality}>
                                <option disabled={useShareableUrl} value="very_high">{getRenderQualityLabel("very_high")}</option>
                                <option value="high">{getRenderQualityLabel("high")}</option>
                                <option value="medium">{getRenderQualityLabel("medium")}</option>
                                <option value="low">{getRenderQualityLabel("low")}</option>
                                <option value="very_low">{getRenderQualityLabel("very_low")}</option>
                            </select>
                        </div>
                    </div>
                </fieldset>
                <fieldset className="fieldset bg-base-100 border border-base-200 px-4 pb-4 rounded-box">
                    <legend className="fieldset-legend">Shareable Link</legend>
                    <span className="mb-4">Shareable links are currently only available for videos up to 10 minutes and with quality and resolution restrictions. </span>
                    <div className="grid grid-cols-2 gap-4">
                        <Toggle rightLabel="Generate link" value={useShareableUrl} justifyBetween={false}
                            onChange={event => setUseShareableUrl(event.target.checked)}
                            disabled={!isShareableUrlEnabled()} />
                        <ShareableUrl useShareableUrl={useShareableUrl} objectId={objectId} />
                    </div>
                </fieldset>
                <fieldset className="fieldset flex flex-row justify-end gap-2 pt-2">
                    <Button disabled={isInitializing} onClick={onCancel} icon={XMarkIcon}>Cancel</Button>
                    <Button className="btn-primary" disabled={!projectState} isLoading={isInitializing}
                        onClick={onAddClicked} icon={QueueListIcon} >Queue render</Button>
                </fieldset>
            </div>
        </div>
    )
}

Form.propTypes = {
    onAdd: PropTypes.func.isRequired,
    onCancel: PropTypes.func.isRequired,
    isVisible: PropTypes.bool.isRequired
}