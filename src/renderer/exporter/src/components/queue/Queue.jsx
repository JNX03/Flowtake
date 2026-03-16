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
import Hint from "../../../../components/Hint"
import {
    isRenderRendering,
    RENDER_CANCELED,
    RENDER_COMPLETED,
    RENDER_PENDING,
    RENDER_STARTING
} from "../../../../src/helpers"
import {
    selectAllRenders,
    updateRender
} from "../../../../src/redux/renderSlice"
import Row from "./Row"

export default function Queue({ isVisible }) {

    const dispatch = useDispatch()

    const [isHintVisible, setIsHintVisible] = useState(true)

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
            {isHintVisible && isRendering && <div className="px-3 pt-3">
                <Hint dismiss={() => setIsHintVisible(false)}>
                    You can close this window, renders will continue in the background.
                </Hint>
            </div>}

            {totalProgress !== null && (
                <div className="px-4 pt-3">
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs opacity-60">Overall progress</span>
                        <span className="text-xs font-medium">{Math.round(totalProgress)}%</span>
                    </div>
                    <progress className="progress progress-primary w-full h-1.5" value={totalProgress} max="100" />
                </div>
            )}

            <div className="flex-1 overflow-y-auto px-3 py-3">
                {renders.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full opacity-40 gap-2">
                        <InboxIcon className="size-10" />
                        <span className="text-sm">No renders in queue</span>
                    </div>
                )}
                {renders.length > 0 && (
                    <ul className="list bg-base-100 rounded-lg overflow-hidden">
                        {renders.map((item, i) => (<Row key={i} id={item.id} onProcessed={startNext} />))}
                    </ul>
                )}
            </div>
        </div>
    )
}

Queue.propTypes = {
    isVisible: PropTypes.bool.isRequired
}
