import {
    ArrowRightIcon,
    XMarkIcon
} from "@heroicons/react/24/outline"
import {
    FilmIcon,
    Square2StackIcon,
    DevicePhoneMobileIcon,
    ComputerDesktopIcon
} from "@heroicons/react/24/solid"
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

const ASPECT_ICONS = {
    "16x9": ComputerDesktopIcon,
    "9x16": DevicePhoneMobileIcon,
    "1x1": Square2StackIcon
}

const ASPECT_LABELS = {
    "16x9": "16:9",
    "9x16": "9:16",
    "1x1": "1:1"
}

const QUALITY_OPTIONS = [
    { value: "very_high", restrictShareable: true },
    { value: "high" },
    { value: "medium" },
    { value: "low" },
    { value: "very_low" }
]

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

    const resolutionLabels = useMemo(() => ({
        "3840x2160": "4K", "2160x3840": "4K", "2160x2160": "4K",
        "1920x1080": "1080p", "1080x1920": "1080p", "1080x1080": "1080p",
        "1280x720": "720p", "720x1280": "720p", "720x720": "720p",
        "854x480": "480p", "480x854": "480p", "480x480": "480p"
    }), [])

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
        if (!projectState) {
            window.electron.ipcRenderer.invoke("get-project-state").then(state => {
                if (state) dispatch(setProjectState(state))
            })
        }
    }, [projectState, dispatch])

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

    const is4K = res => res === "3840x2160" || res === "2160x3840" || res === "2160x2160"

    return (
        <div className={`flex flex-col h-full ${isVisible ? "" : "hidden"}`}>
            <div className="flex-1 overflow-y-auto px-4 py-3">
                <div className="flex flex-col gap-3">
                    {/* Aspect Ratio - visual toggle buttons */}
                    <div>
                        <label className="label text-xs opacity-60 mb-1.5">Aspect Ratio</label>
                        <div className="flex gap-2">
                            {Object.entries(ASPECT_LABELS).map(([value, label]) => {
                                const Icon = ASPECT_ICONS[value]
                                return (
                                    <button
                                        key={value}
                                        onClick={() => setAspectRatio(value)}
                                        className={`btn btn-sm flex-1 gap-1.5 ${aspectRatio === value ? "btn-primary" : "btn-ghost bg-base-100"}`}
                                    >
                                        <Icon className="size-4" />
                                        {label}
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {/* Resolution - visual toggle buttons */}
                    <div>
                        <label className="label text-xs opacity-60 mb-1.5">Resolution</label>
                        <div className="flex gap-2">
                            {resolutions.map(res => {
                                const disabled4K = useShareableUrl && is4K(res)
                                return (
                                    <button
                                        key={res}
                                        onClick={() => !disabled4K && setResolutionString(res)}
                                        disabled={disabled4K || isPendingSetResolutionString || isPendingResolutionString}
                                        className={`btn btn-sm flex-1 ${resolutionString === res ? "btn-primary" : "btn-ghost bg-base-100"} ${disabled4K ? "opacity-30" : ""}`}
                                    >
                                        <span className="text-xs">{resolutionLabels[res] || res}</span>
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {/* Frame Rate & Quality - side by side */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="label text-xs opacity-60 mb-1.5">Frame Rate</label>
                            <div className="flex gap-2">
                                {[60, 30].map(fpsOption => (
                                    <button
                                        key={fpsOption}
                                        onClick={() => setFps(fpsOption)}
                                        disabled={isPendingSetFps || isPendingFps}
                                        className={`btn btn-sm flex-1 ${fps === fpsOption ? "btn-primary" : "btn-ghost bg-base-100"}`}
                                    >
                                        {fpsOption} FPS
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="label text-xs opacity-60 mb-1.5">Quality</label>
                            <select onChange={onQualityChange} value={quality}
                                className="select select-sm w-full bg-base-100"
                                disabled={isPendingSetQuality || isPendingQuality}>
                                {QUALITY_OPTIONS.map(opt => (
                                    <option
                                        key={opt.value}
                                        disabled={useShareableUrl && opt.restrictShareable}
                                        value={opt.value}
                                    >
                                        {getRenderQualityLabel(opt.value)}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Info text */}
                    <p className="text-xs opacity-40 leading-relaxed">
                        Lower resolution and frame rate for faster exports. Quality affects file size but not export speed.
                    </p>

                    {/* Shareable Link */}
                    <div className="bg-base-100 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium">Shareable Link</span>
                            <Toggle rightLabel="" value={useShareableUrl} justifyBetween={false}
                                onChange={event => setUseShareableUrl(event.target.checked)}
                                disabled={!isShareableUrlEnabled()} />
                        </div>
                        {useShareableUrl && (
                            <ShareableUrl useShareableUrl={useShareableUrl} objectId={objectId} />
                        )}
                        {!isShareableUrlEnabled() && (
                            <p className="text-xs opacity-40">Available for videos up to 10 minutes.</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Bottom action bar */}
            <div className="px-4 py-3 border-t border-base-content/5 flex items-center justify-between">
                <button onClick={onCancel} disabled={isInitializing}
                    className="btn btn-sm btn-ghost gap-1">
                    <XMarkIcon className="size-4" />
                    Cancel
                </button>
                <Button
                    className="btn-sm btn-primary gap-1"
                    disabled={!projectState}
                    isLoading={isInitializing}
                    onClick={onAddClicked}
                    icon={ArrowRightIcon}
                >
                    Export
                </Button>
            </div>
        </div>
    )
}

Form.propTypes = {
    onAdd: PropTypes.func.isRequired,
    onCancel: PropTypes.func.isRequired,
    isVisible: PropTypes.bool.isRequired
}
