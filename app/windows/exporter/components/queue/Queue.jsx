import { InboxIcon } from "@heroicons/react/24/outline"
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
import {
    isRenderRendering,
    RENDER_CANCELED,
    RENDER_COMPLETED,
    RENDER_PENDING,
    RENDER_STARTING
} from "@shared/helpers"
import {
    selectAllRenders,
    updateRender
} from "@shared/redux/renderSlice"
import Row from "./Row"

export default function Queue({ isVisible, onPreview, onUpload }) {

    const dispatch = useDispatch()

    const renders = useSelector(selectAllRenders)
    const progress = useSelector(state => state.render.progress)

    const isRendering = useMemo(() =>
        renders.filter(({ status }) => status !== RENDER_COMPLETED && status !== RENDER_CANCELED).length > 0,
        [renders]
    )

    const totalProgress = useMemo(() => {
        if (!isRendering) return null

        const numberOfRenders = renders.filter(({ status }) => status !== RENDER_CANCELED).length
        if (numberOfRenders === 0) return null

        const completedRenders = renders.filter(({ status }) => status === RENDER_COMPLETED).length
        return (completedRenders / numberOfRenders) * 100 + progress / numberOfRenders
    }, [progress, renders, isRendering])

    const startNext = useCallback(() => {
        const nextRender = renders.find(item => item.status === RENDER_PENDING)
        if (nextRender) dispatch(updateRender({ id: nextRender.id, changes: { status: RENDER_STARTING } }))
    }, [dispatch, renders])

    useEffect(() => {
        const current = renders.find(isRenderRendering)
        if (!current) startNext()
    }, [renders, startNext])

    useEffect(() => {
        window.electron.ipcRenderer.invoke("set-progress-bar", totalProgress === null ? -1 : totalProgress / 100)
    }, [totalProgress])

    return (
        <div className={`h-full flex flex-col ${isVisible ? "" : "hidden"}`}>
            {/* Progress bar */}
            {totalProgress !== null && (
                <div className="px-5 pt-3">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-medium opacity-40">Overall progress</span>
                        <span className="text-[11px] font-semibold">{Math.round(totalProgress)}%</span>
                    </div>
                    <div className="h-1 bg-base-100 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-primary rounded-full transition-all duration-300"
                            style={{ width: `${totalProgress}%` }}
                        />
                    </div>
                    {isRendering && (
                        <p className="text-[10px] opacity-30 mt-2">
                            You can close this window, renders continue in the background.
                        </p>
                    )}
                </div>
            )}

            {/* Render list */}
            <div className="flex-1 overflow-y-auto px-5 py-3">
                {renders.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full gap-3">
                        <div className="w-12 h-12 rounded-full bg-base-100 flex items-center justify-center">
                            <InboxIcon className="size-5 opacity-30" />
                        </div>
                        <span className="text-xs opacity-30">No renders in queue</span>
                    </div>
                )}
                {renders.length > 0 && (
                    <div className="flex flex-col gap-2">
                        {renders.map((item, i) => (
                            <Row key={i} id={item.id} onProcessed={startNext} onPreview={onPreview} onUpload={onUpload} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

Queue.propTypes = {
    isVisible: PropTypes.bool.isRequired,
    onPreview: PropTypes.func.isRequired,
    onUpload: PropTypes.func.isRequired,
}
