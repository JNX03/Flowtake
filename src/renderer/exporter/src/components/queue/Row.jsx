import {
    ArrowUpTrayIcon,
    CheckCircleIcon,
    EyeIcon,
    FolderOpenIcon,
    PlayIcon,
    TrashIcon,
    XCircleIcon
} from "@heroicons/react/24/outline"
import { CloudArrowUpIcon } from "@heroicons/react/24/solid"
import { useQuery } from "@tanstack/react-query"
import PropTypes from "prop-types"
import {
    useCallback,
    useEffect,
    useState
} from "react"
import {
    useDispatch,
    useSelector
} from "react-redux"
import {
    getRenderQualityLabel,
    isRenderRendering,
    RENDER_CANCELED,
    RENDER_CANCELING,
    RENDER_COMPLETED,
    RENDER_INITIALIZING,
    RENDER_PENDING,
    RENDER_PROCESSING_AUDIO,
    RENDER_RENDERING,
    RENDER_STARTING,
    RENDER_UPLOADING
} from "../../../../src/helpers"
import {
    removeRender,
    selectProgress,
    selectRenderById,
    updateRender
} from "../../../../src/redux/renderSlice"
import RenderWorkerManager from "../../../../src/workers/RenderWorkerManager"
import CopyButton from "../CopyButton"
import UploadStatus from "./UploadStatus"

export default function Row({ id, onProcessed, onPreview, onUpload }) {
    const dispatch = useDispatch()

    const render = useSelector(state => selectRenderById(state, id))
    const progress = useSelector(selectProgress)

    const [uploadProgress, setUploadProgress] = useState(0)

    const { data: manager } = useQuery({
        queryKey: ['manager', render.id, onProcessed],
        queryFn: async () => {
            const manager = new RenderWorkerManager(render)
            await manager.start(onProcessed)
            return manager
        },
        staleTime: Infinity,
        enabled: render.status !== RENDER_PENDING
    })

    const remove = useCallback(() => dispatch(removeRender(id)), [dispatch, id])

    const cancel = useCallback(async () => {
        dispatch(updateRender({ id, changes: { status: RENDER_CANCELING } }))
    }, [dispatch, id])

    const retryUpload = useCallback(async () => {
        dispatch(updateRender({ id, changes: { status: RENDER_UPLOADING } }))
        await window.electron.ipcRenderer.invoke("upload", render.id)
        dispatch(updateRender({ id, changes: { status: RENDER_COMPLETED } }))
    }, [dispatch, id, render.id])

    const url = useCallback(() =>
        render.upload.objectId ? `https://getflowtake.com/videos/${render.upload.objectId}` : "",
        [render.upload.objectId])

    const revealInExplorer = useCallback(() => {
        window.electron.ipcRenderer.invoke("reveal-video-in-file-explorer", id)
    }, [id])

    const playVideo = useCallback(() => {
        window.electron.ipcRenderer.invoke("play-video", id)
    }, [id])

    useEffect(() => {
        switch (render.status) {
            case RENDER_COMPLETED:
            case RENDER_CANCELED:
                manager?.terminate()
                break
            case RENDER_CANCELING:
                manager?.cancel()
                break
        }
    }, [render.status, manager])

    useEffect(() => {
        window.electron.ipcRenderer.on('upload-progress', (_e, progress) => setUploadProgress(progress))
    }, [])

    const isActive = isRenderRendering(render)
    const isProcessing = render.status === RENDER_STARTING ||
        render.status === RENDER_INITIALIZING ||
        render.status === RENDER_PROCESSING_AUDIO ||
        render.status === RENDER_UPLOADING ||
        render.status === RENDER_CANCELING

    return (
        <div className={`bg-base-100 rounded-lg p-3 transition-all ${
            isActive ? "ring-1 ring-primary/20" : ""
        }`}>
            {/* Top: status + name + config */}
            <div className="flex items-start gap-3">
                {/* Status indicator */}
                <div className="flex-none mt-0.5">
                    {render.status === RENDER_PENDING && (
                        <div className="w-5 h-5 rounded-full bg-base-content/5 flex items-center justify-center">
                            <div className="w-1.5 h-1.5 rounded-full bg-base-content/30" />
                        </div>
                    )}
                    {render.status === RENDER_COMPLETED && (
                        <CheckCircleIcon className="size-5 text-success" />
                    )}
                    {render.status === RENDER_CANCELED && (
                        <XCircleIcon className="size-5 text-error/60" />
                    )}
                    {isProcessing && (
                        <span className="loading loading-spinner loading-sm" />
                    )}
                    {render.status === RENDER_RENDERING && (
                        <div className="relative w-5 h-5">
                            <svg className="w-5 h-5 -rotate-90" viewBox="0 0 20 20">
                                <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor"
                                    strokeWidth="2" className="opacity-10" />
                                <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor"
                                    strokeWidth="2" className="text-primary"
                                    strokeDasharray={`${(progress / 100) * 50.27} 50.27`}
                                    strokeLinecap="round" />
                            </svg>
                        </div>
                    )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">
                        {render.state.undoableState.present.project.name}
                    </div>
                    <div className="text-[11px] opacity-40 mt-0.5">
                        {render.config.resolution.x}x{render.config.resolution.y}
                        {" \u00B7 "}
                        {render.config.fps} FPS
                        {" \u00B7 "}
                        {getRenderQualityLabel(render.config.quality)}
                        {render.status === RENDER_RENDERING && (
                            <span className="text-primary ml-1.5 font-medium">{Math.round(progress)}%</span>
                        )}
                        <UploadStatus id={id} uploadProgress={uploadProgress} />
                    </div>
                </div>
            </div>

            {/* Render progress bar */}
            {render.status === RENDER_RENDERING && (
                <div className="mt-2.5 h-1 bg-base-300 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-primary rounded-full transition-all duration-300"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-1 mt-2.5 -mb-0.5">
                {render.status === RENDER_PENDING && (
                    <button onClick={remove} className="text-[11px] opacity-40 hover:opacity-70 hover:text-error flex items-center gap-1 transition-all">
                        <TrashIcon className="size-3.5" /> Remove
                    </button>
                )}

                {uploadProgress === -1 && (
                    <button onClick={retryUpload} className="text-[11px] opacity-40 hover:opacity-70 flex items-center gap-1 transition-all">
                        <CloudArrowUpIcon className="size-3.5" /> Retry upload
                    </button>
                )}

                {render.upload.isRequested && render.status !== RENDER_CANCELED && (
                    <CopyButton value={url()} className="btn-ghost btn-xs" tooltip="Copy link" />
                )}

                {isRenderRendering(render) && render.status !== RENDER_CANCELING && (
                    <button onClick={cancel} className="text-[11px] opacity-40 hover:opacity-70 hover:text-error flex items-center gap-1 transition-all">
                        Cancel
                    </button>
                )}
                {render.status === RENDER_CANCELING && (
                    <span className="text-[11px] opacity-30 flex items-center gap-1">
                        <span className="loading loading-spinner loading-xs" /> Canceling...
                    </span>
                )}

                {render.status === RENDER_COMPLETED && (
                    <div className="flex items-center gap-0.5 w-full">
                        <button
                            onClick={() => onPreview(id, render.state.undoableState.present.project.name)}
                            className="text-[11px] font-medium text-primary/70 hover:text-primary flex items-center gap-1 transition-all"
                        >
                            <EyeIcon className="size-3.5" /> Preview
                        </button>
                        <span className="opacity-20 mx-1">&middot;</span>
                        <button
                            onClick={() => onUpload(id, render.state.undoableState.present.project.name)}
                            className="text-[11px] opacity-40 hover:opacity-70 flex items-center gap-1 transition-all"
                        >
                            <ArrowUpTrayIcon className="size-3.5" /> Upload
                        </button>
                        <span className="opacity-20 mx-1">&middot;</span>
                        <button
                            onClick={revealInExplorer}
                            className="text-[11px] opacity-40 hover:opacity-70 flex items-center gap-1 transition-all"
                        >
                            <FolderOpenIcon className="size-3.5" /> Folder
                        </button>
                        <span className="opacity-20 mx-1">&middot;</span>
                        <button
                            onClick={playVideo}
                            className="text-[11px] opacity-40 hover:opacity-70 flex items-center gap-1 transition-all"
                        >
                            <PlayIcon className="size-3.5" /> Play
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}

Row.propTypes = {
    id: PropTypes.string.isRequired,
    onProcessed: PropTypes.func.isRequired,
    onPreview: PropTypes.func.isRequired,
    onUpload: PropTypes.func.isRequired,
}
