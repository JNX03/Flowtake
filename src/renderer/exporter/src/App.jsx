import { PlusIcon } from "@heroicons/react/16/solid"
import { useQuery } from "@tanstack/react-query"
import {
    useEffect,
    useMemo,
    useRef,
    useState
} from "react"
import {
    useDispatch,
    useSelector
} from "react-redux"
import TitleBar from "../../components/TitleBar"
import {
    EXPORTER_SECTION_NEW_RENDER,
    EXPORTER_SECTION_QUEUE,
    isRenderRendering,
    RENDER_CANCELING,
    RENDER_COMPLETED
} from "../../src/helpers"
import {
    removeRenders,
    selectAllRenders,
    selectProjectState,
    selectTotalRenders,
    updateRender
} from "../../src/redux/renderSlice"
import Form from "./components/form/NewRenderForm"
import Queue from "./components/queue/Queue"
import Toasts from "./components/Toasts"

export default function App() {

    const dispatch = useDispatch()

    const renders = useSelector(selectAllRenders)
    const totalRenders = useSelector(selectTotalRenders)
    const projectState = useSelector(selectProjectState)

    const rendersRef = useRef(renders)

    const { data: initialOpenSection, isPending, isError } = useQuery({
        queryKey: ['initialOpenSection'],
        queryFn: () => window.electron.ipcRenderer.invoke("get-open-section"),
        staleTime: Infinity
    })

    // Use a derived state pattern - calculate openSection based on query state
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
        window.electron.ipcRenderer.on('cancel-running-render', () => dispatch(updateRender(
            { id: rendersRef.current.find(isRenderRendering).id, changes: { status: RENDER_CANCELING } }
        )))
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

    const getTitle = () => {
        switch (openSection) {
            case EXPORTER_SECTION_QUEUE: return "Render queue"
            case EXPORTER_SECTION_NEW_RENDER: return "New render"
        }
    }

    return (<>
        <TitleBar overlayButtons={2} title={getTitle()} >
            {openSection === EXPORTER_SECTION_QUEUE && projectState !== null &&
                <button onClick={() => { setUserOpenSection(EXPORTER_SECTION_NEW_RENDER) }} className="mt-1 btn btn-xs" >
                    <PlusIcon className="size-4" /> New render
                </button>}
        </TitleBar>
        {!isPending && <div className="px-2 pb-2 h-full">
            <Form onAdd={onAdd} onCancel={onCancelNewRender}
                isVisible={openSection === EXPORTER_SECTION_NEW_RENDER} />
            <Queue isVisible={openSection === EXPORTER_SECTION_QUEUE} />
        </div>}
        {isPending && <div className="flex items-center justify-center h-full">
            <span className="loading loading-spinner loading-md" />
        </div>}
        <Toasts />
    </>)
}