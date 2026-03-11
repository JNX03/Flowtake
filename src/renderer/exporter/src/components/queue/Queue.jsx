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
        <div className={`h-full flex flex-col gap-2 ${isVisible ? "" : "hidden"}`}>
            {isHintVisible && isRendering && <Hint dismiss={() => setIsHintVisible(false)}>
                This is your render queue. You can close this window, your renders will continue in the background.
            </Hint>}
            <ul className="flex-1 overflow-y-auto overflow-x-hidden list bg-base-100 rounded-box shadow-md">
                <li className="p-4 pb-2 flex flex-row items-center justify-between">
                    <span className="text-xs opacity-60 tracking-wide">Render queue</span>
                    {totalProgress !== null && (<progress className="progress progress-info w-42" value={totalProgress} max="100" />)}
                </li>
                {renders.map((item, i) => (<Row key={i} id={item.id} onProcessed={startNext} />))}
            </ul>
        </div >
    )
}

Queue.propTypes = {
    isVisible: PropTypes.bool.isRequired
}