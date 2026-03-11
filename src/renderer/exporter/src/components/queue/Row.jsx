import {
    CheckIcon,
    ChevronRightIcon,
    CloudArrowUpIcon,
    FolderIcon,
    PlayIcon,
    TrashIcon,
    XMarkIcon
} from "@heroicons/react/24/outline"
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
import Button from "../../../../components/Button"
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

export default function Row({ id, onProcessed }) {
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

    return (<li className="list-row">
        <div className="size-10 flex items-center justify-center">
            {render.status === RENDER_PENDING && <ChevronRightIcon className="h-6 w-6" />}
            {render.status === RENDER_COMPLETED && <CheckIcon className="h-6 w-6 text-success" />}
            {render.status === RENDER_CANCELED && <XMarkIcon className="h-6 w-6 text-error" />}
            {(render.status === RENDER_STARTING ||
                render.status === RENDER_INITIALIZING ||
                render.status === RENDER_PROCESSING_AUDIO ||
                render.status === RENDER_UPLOADING ||
                render.status === RENDER_CANCELING) &&
                <span className="loading loading-spinner loading-xl"></span>}
            {render.status === RENDER_RENDERING && <div
                className="radial-progress text-xs"
                style={{
                    "--value": progress,
                    "--size": "2.5rem",
                    "--thickness": "4px"
                }}
                aria-valuenow={progress}
                role="progressbar"
            >
                {Math.round(progress)}%
            </div>}
        </div>
        <div>
            <div>{render.state.undoableState.present.project.name}</div>
            <div className="text-xs font-semibold opacity-60">
                {render.config.resolution.x}x{render.config.resolution.y}{" · "}
                {render.config.fps}FPS{" · "}
                {getRenderQualityLabel(render.config.quality)} quality
                <UploadStatus id={id} uploadProgress={uploadProgress} />
            </div>
        </div>
        {render.status === RENDER_PENDING && <Button
            className="btn-ghost btn-square"
            tooltip="Remove"
            onClick={remove}
            icon={TrashIcon}
        />}
        {uploadProgress === -1 && (
            <Button
                className="btn-ghost btn-square"
                tooltip={"Retry upload"}
                onClick={retryUpload}
                icon={CloudArrowUpIcon}
            />
        )}
        {render.upload.isRequested && render.status !== RENDER_CANCELED &&
            <CopyButton value={url()} className="btn-ghost btn-square" tooltip="Copy link" />}
        {isRenderRendering(render) &&
            <Button
                className="btn-ghost btn-square"
                tooltip={render.status !== RENDER_CANCELING ? "Cancel" : ""}
                onClick={cancel}
                disabled={render.status === RENDER_CANCELING}
                isLoading={render.status === RENDER_CANCELING}
                icon={XMarkIcon}
            />}
        {render.status === RENDER_COMPLETED && <>
            <Button
                className="btn-ghost btn-square"
                tooltip="Reveal in File Explorer"
                onClick={revealInExplorer}
                icon={FolderIcon}
            />
            <Button
                className="btn-ghost btn-square"
                tooltip="Play video"
                onClick={playVideo}
                icon={PlayIcon}
            />
        </>}
    </li>)
}

Row.propTypes = {
    id: PropTypes.string.isRequired,
    onProcessed: PropTypes.func.isRequired,
}