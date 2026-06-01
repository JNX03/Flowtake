import {
    ArrowRightIcon
} from "@heroicons/react/24/outline"
import {
    DevicePhoneMobileIcon,
    ComputerDesktopIcon,
    Square2StackIcon
} from "@heroicons/react/24/solid"
import {
    useMutation,
    useQuery,
    useQueryClient
} from "@tanstack/react-query"
import PropTypes from "prop-types"
import {
    useEffect,
    useMemo,
    useState
} from "react"
import {
    useDispatch,
    useSelector
} from "react-redux"
import {
    getRenderQualityLabel,
    RENDER_PENDING,
    TOAST_ERROR
} from "@shared/helpers"
import { buildGitHubIssueUrl } from "@shared/errorReporting"
import {
    createRenderableProjectState,
    getRenderProjectName
} from "@shared/renderState"
import {
    addRender,
    addToast,
    selectProjectState,
    setProjectState
} from "@shared/redux/renderSlice"
import { captureException } from "@shared/sentryHelpers"

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

const QUALITY_OPTIONS = ["very_high", "high", "medium", "low", "very_low"]

export default function Form({ onAdd, onCancel, isVisible }) {

    const dispatch = useDispatch()
    const queryClient = useQueryClient()

    const [aspectRatio, setAspectRatio] = useState("16x9")
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

    const onAddClicked = async () => {
        setIsInitializing(true)

        const [x, y] = resolutionString.split("x")
        const resolution = { x: Number(x), y: Number(y) }
        const state = createRenderableProjectState(projectState, resolution)

        const render = {
            state,
            projectName: getRenderProjectName(projectState),
            status: RENDER_PENDING,
            config: { resolution, fps, aspectRatio, quality },
            upload: { isRequested: false, presignedUrl: null, objectId: null },
            timestamp: Date.now(),
            id: `render-${self.crypto.randomUUID()}`
        }
        try {
            await window.electron.ipcRenderer.invoke("queue-render", render)
            dispatch(addRender(render))
            onAdd()
        } catch (e) {
            const message = (typeof e === "string" ? e : e?.message) || "Couldn't queue render"
            dispatch(addToast({ type: TOAST_ERROR, text: message, autoDismiss: false, actions: [{ label: "Report", url: buildGitHubIssueUrl(message) }] }))
            captureException(e)
        } finally {
            setIsInitializing(false)
        }
    }

    return (
        <div className={`flex flex-col h-full ${isVisible ? "" : "hidden"}`}>
            <div className="flex-1 overflow-y-auto px-5 py-4">
                <div className="flex flex-col gap-5">

                    {/* Aspect Ratio */}
                    <div>
                        <span className="text-[11px] font-medium uppercase tracking-wider opacity-40 mb-2 block">
                            Aspect Ratio
                        </span>
                        <div className="grid grid-cols-3 gap-1.5">
                            {Object.entries(ASPECT_LABELS).map(([value, label]) => {
                                const Icon = ASPECT_ICONS[value]
                                return (
                                    <button
                                        key={value}
                                        onClick={() => setAspectRatio(value)}
                                        className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-all ${
                                            aspectRatio === value
                                                ? "bg-primary text-primary-content"
                                                : "bg-base-100 text-base-content/60 hover:text-base-content hover:bg-base-100/80"
                                        }`}
                                    >
                                        <Icon className="size-3.5" />
                                        {label}
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {/* Resolution */}
                    <div>
                        <span className="text-[11px] font-medium uppercase tracking-wider opacity-40 mb-2 block">
                            Resolution
                        </span>
                        <div className="grid grid-cols-4 gap-1.5">
                            {resolutions.map(res => (
                                <button
                                    key={res}
                                    onClick={() => setResolutionString(res)}
                                    disabled={isPendingSetResolutionString || isPendingResolutionString}
                                    className={`py-2 rounded-lg text-xs font-medium transition-all ${
                                        resolutionString === res
                                            ? "bg-primary text-primary-content"
                                            : "bg-base-100 text-base-content/60 hover:text-base-content hover:bg-base-100/80"
                                    }`}
                                >
                                    {resolutionLabels[res] || res}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Frame Rate & Quality */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <span className="text-[11px] font-medium uppercase tracking-wider opacity-40 mb-2 block">
                                Frame Rate
                            </span>
                            <div className="grid grid-cols-2 gap-1.5">
                                {[60, 30].map(fpsOption => (
                                    <button
                                        key={fpsOption}
                                        onClick={() => setFps(fpsOption)}
                                        disabled={isPendingSetFps || isPendingFps}
                                        className={`py-2 rounded-lg text-xs font-medium transition-all ${
                                            fps === fpsOption
                                                ? "bg-primary text-primary-content"
                                                : "bg-base-100 text-base-content/60 hover:text-base-content hover:bg-base-100/80"
                                        }`}
                                    >
                                        {fpsOption} FPS
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <span className="text-[11px] font-medium uppercase tracking-wider opacity-40 mb-2 block">
                                Quality
                            </span>
                            <select
                                onChange={e => setQuality(e.target.value)}
                                value={quality}
                                className="select select-sm w-full bg-base-100 border-0 text-xs font-medium rounded-lg h-auto py-2"
                                disabled={isPendingSetQuality || isPendingQuality}
                            >
                                {QUALITY_OPTIONS.map(value => (
                                    <option key={value} value={value}>
                                        {getRenderQualityLabel(value)}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <p className="text-[11px] opacity-30 leading-relaxed">
                        Lower resolution and frame rate for faster exports.
                    </p>
                </div>
            </div>

            {/* Output summary + actions */}
            <div className="flex-none border-t border-base-content/5 px-5 pt-3 pb-4">
                <div className="flex items-center justify-center gap-2 text-[11px] mb-3 select-none">
                    <span className="font-semibold text-base-content/70">MP4</span>
                    <span className="text-base-content/20">&middot;</span>
                    <span className="text-base-content/50">{resolutionString ? resolutionString.replace("x", "×") : "…"}</span>
                    <span className="text-base-content/20">&middot;</span>
                    <span className="text-base-content/50">{fps ?? "…"} FPS</span>
                    <span className="text-base-content/20">&middot;</span>
                    <span className="text-base-content/50">{quality ? getRenderQualityLabel(quality) : "…"}</span>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={onCancel}
                        disabled={isInitializing}
                        className="flex-1 py-2.5 rounded-lg text-xs font-medium bg-base-100 text-base-content/60 hover:text-base-content transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onAddClicked}
                        disabled={!projectState || isInitializing}
                        className="flex-[1.4] py-2.5 rounded-lg text-xs font-semibold bg-primary text-primary-content hover:brightness-110 transition-all flex items-center justify-center gap-1.5 disabled:opacity-40"
                    >
                        {isInitializing && <span className="loading loading-spinner loading-xs" />}
                        {!isInitializing && <>Export <ArrowRightIcon className="size-3.5" /></>}
                    </button>
                </div>
            </div>
        </div>
    )
}

Form.propTypes = {
    onAdd: PropTypes.func.isRequired,
    onCancel: PropTypes.func.isRequired,
    isVisible: PropTypes.bool.isRequired
}
