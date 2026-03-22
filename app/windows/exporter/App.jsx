import { useQuery } from "@tanstack/react-query"
import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState
} from "react"
import {
    useDispatch,
    useSelector
} from "react-redux"
import {
    EXPORTER_SECTION_NEW_RENDER,
    EXPORTER_SECTION_QUEUE,
    isRenderRendering,
    RENDER_CANCELING,
    RENDER_COMPLETED
} from "@shared/helpers"
import {
    removeRenders,
    selectAllRenders,
    selectProjectState,
    selectTotalRenders,
    updateRender
} from "@shared/redux/renderSlice"
import Form from "./components/form/NewRenderForm"
import Queue from "./components/queue/Queue"
import SocialUploadModal from "./components/SocialUploadModal"
import Toasts from "./components/Toasts"
import VideoPreviewModal from "./components/VideoPreviewModal"

export default function App() {

    const dispatch = useDispatch()

    const renders = useSelector(selectAllRenders)
    const totalRenders = useSelector(selectTotalRenders)
    const projectState = useSelector(selectProjectState)

    const [previewState, setPreviewState] = useState({ isOpen: false, renderId: null, videoName: null })
    const [uploadState, setUploadState] = useState({ isOpen: false, renderId: null, videoName: null })

    const onPreview = useCallback((renderId, videoName) => {
        setPreviewState({ isOpen: true, renderId, videoName })
    }, [])

    const closePreview = useCallback(() => {
        setPreviewState({ isOpen: false, renderId: null, videoName: null })
    }, [])

    const onUpload = useCallback((renderId, videoName) => {
        setUploadState({ isOpen: true, renderId, videoName })
    }, [])

    const closeUpload = useCallback(() => {
        setUploadState({ isOpen: false, renderId: null, videoName: null })
    }, [])

    const rendersRef = useRef(renders)

    const { data: initialOpenSection, isPending, isError } = useQuery({
        queryKey: ['initialOpenSection'],
        queryFn: () => window.electron.ipcRenderer.invoke("get-open-section"),
        staleTime: Infinity
    })

    const [userOpenSection, setUserOpenSection] = useState(null)

    const openSection = useMemo(() => {
        return userOpenSection ?? (
            !isPending && !isError && initialOpenSection
                ? initialOpenSection
                : EXPORTER_SECTION_NEW_RENDER
        )
    }, [userOpenSection, isPending, isError, initialOpenSection])

    useEffect(() => { rendersRef.current = renders }, [renders])

    useEffect(() => {
        window.electron.ipcRenderer.on('open-section', (_e, section) => setUserOpenSection(section))
        window.electron.ipcRenderer.on('clear-pending-renders', () => dispatch(removeRenders(
            rendersRef.current.filter(render => !isRenderRendering(render)).map(({ id }) => id)
        )))
        window.electron.ipcRenderer.on('cancel-running-render', () => {
            const renderingRender = rendersRef.current.find(isRenderRendering)
            if (renderingRender) dispatch(updateRender(
                { id: renderingRender.id, changes: { status: RENDER_CANCELING } }
            ))
        })
    }, [dispatch])

    useEffect(() => {
        const hasRenderingRenders = renders.filter(isRenderRendering).length > 0
        window.electron.ipcRenderer.invoke("set-close-mode", hasRenderingRenders ? "hide" : "close")
    }, [renders])

    useEffect(() => {
        const hasRenderingOrCompletedRenders =
            renders.filter(render => isRenderRendering(render) || render.status === RENDER_COMPLETED).length > 0
        window.electron.ipcRenderer.invoke("set-has-rendering-or-completed-renders", hasRenderingOrCompletedRenders)
    }, [renders])

    const onAdd = () => setUserOpenSection(EXPORTER_SECTION_QUEUE)

    const onCancelNewRender = () => {
        if (totalRenders > 0) setUserOpenSection(EXPORTER_SECTION_QUEUE)
        else window.electron.ipcRenderer.invoke("close-exporter-window")
    }

    return (
        <div className="h-full flex flex-col bg-base-300 rounded-xl overflow-hidden border border-base-content/10">
            {/* Drag region - no window controls */}
            <div className="h-8 flex-none flex items-center select-none" style={{ WebkitAppRegion: "drag" }}>
                <span className="text-[11px] font-medium opacity-40 pl-4">Flowtake</span>
            </div>

            {/* Tab navigation */}
            <div className="px-5 pb-1" style={{ WebkitAppRegion: "no-drag" }}>
                <div className="flex gap-1 bg-base-100/50 rounded-lg p-1">
                    <button
                        onClick={() => setUserOpenSection(EXPORTER_SECTION_NEW_RENDER)}
                        disabled={!projectState}
                        className={`flex-1 text-xs font-medium py-1.5 px-3 rounded-md transition-all ${
                            openSection === EXPORTER_SECTION_NEW_RENDER
                                ? "bg-base-100 text-base-content shadow-sm"
                                : "text-base-content/50 hover:text-base-content/70"
                        }`}
                    >
                        New Export
                    </button>
                    <button
                        onClick={() => setUserOpenSection(EXPORTER_SECTION_QUEUE)}
                        className={`flex-1 text-xs font-medium py-1.5 px-3 rounded-md transition-all flex items-center justify-center gap-1.5 ${
                            openSection === EXPORTER_SECTION_QUEUE
                                ? "bg-base-100 text-base-content shadow-sm"
                                : "text-base-content/50 hover:text-base-content/70"
                        }`}
                    >
                        Queue
                        {totalRenders > 0 && (
                            <span className="bg-primary/15 text-primary text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none">
                                {totalRenders}
                            </span>
                        )}
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden">
                {!isPending && <div className="h-full overflow-y-auto">
                    <Form onAdd={onAdd} onCancel={onCancelNewRender}
                        isVisible={openSection === EXPORTER_SECTION_NEW_RENDER} />
                    <Queue isVisible={openSection === EXPORTER_SECTION_QUEUE} onPreview={onPreview} onUpload={onUpload} />
                </div>}
                {isPending && <div className="flex items-center justify-center h-full">
                    <span className="loading loading-spinner loading-sm opacity-40" />
                </div>}
            </div>

            <Toasts />
            <VideoPreviewModal
                renderId={previewState.renderId}
                videoName={previewState.videoName}
                isOpen={previewState.isOpen}
                onClose={closePreview}
            />
            <SocialUploadModal
                renderId={uploadState.renderId}
                videoName={uploadState.videoName}
                isOpen={uploadState.isOpen}
                onClose={closeUpload}
            />
        </div>
    )
}
