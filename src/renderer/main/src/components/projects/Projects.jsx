import {
    ChevronLeftIcon,
    ChevronRightIcon,
    DocumentMagnifyingGlassIcon
} from "@heroicons/react/24/outline"
import { useQuery } from "@tanstack/react-query"
import PropTypes from 'prop-types'
import {
    useCallback,
    useState
} from "react"
import {
    useDispatch,
    useSelector
} from "react-redux"
import Button from "../../../../components/Button"
import { openProject } from "../../../../src/helpers"
import { selectTargetScale as selectCameraZoomTargetScale } from "../../../../src/redux/cameraZoomSlice"
import {
    selectLayout,
    selectMicrophoneAudioVolume,
    selectPlaybackRate,
    selectSystemAudioVolume
} from "../../../../src/redux/clipSlice"
import {
    selectAlpha,
    selectBorderRadius,
    selectFill,
    selectBlurStrength as selectMaskBlurStrength
} from "../../../../src/redux/maskSlice"
import {
    selectIntro,
    selectOutro,
    selectBlurStrength as selectZoomBlurStrength,
    selectTargetScale as selectZoomTargetScale
} from "../../../../src/redux/zoomSlice"
import ProjectRow from "./Row"

export default function Projects({ isOpen }) {

    const [page, setPage] = useState(0)
    const [isOpening, setIsOpening] = useState(false)

    const dispatch = useDispatch()
    const layout = useSelector(selectLayout)
    const microphoneAudioVolume = useSelector(selectMicrophoneAudioVolume)
    const systemAudioVolume = useSelector(selectSystemAudioVolume)
    const zoomBlurStrength = useSelector(selectZoomBlurStrength)
    const cameraZoomTargetScale = useSelector(selectCameraZoomTargetScale)
    const playbackRate = useSelector(selectPlaybackRate)
    const maskBlurStrength = useSelector(selectMaskBlurStrength)
    const maskAlpha = useSelector(selectAlpha)
    const maskBorderRadius = useSelector(selectBorderRadius)
    const maskFill = useSelector(selectFill)
    const intro = useSelector(selectIntro)
    const outro = useSelector(selectOutro)
    const zoomTargetScale = useSelector(selectZoomTargetScale)

    const { data: projects, isPending, isError, refetch } = useQuery({
        queryKey: ['projects', page],
        queryFn: () => window.electron.ipcRenderer.invoke("store-get-paginated", "projects", page, 30),
        staleTime: Infinity
    })

    const findProject = useCallback(async () => {
        setIsOpening(true)
        const id = await window.electron.ipcRenderer.invoke("find-project")
        if (id != null) {
            const actions = await openProject(id, false, layout, microphoneAudioVolume, systemAudioVolume,
                zoomBlurStrength, cameraZoomTargetScale, playbackRate, maskBlurStrength, maskAlpha, maskBorderRadius,
                maskFill, intro, outro, zoomTargetScale)
            actions.forEach(action => dispatch(action))
        }
        setIsOpening(false)
    }, [layout, microphoneAudioVolume, systemAudioVolume, zoomBlurStrength, cameraZoomTargetScale, playbackRate,
        maskBlurStrength, maskAlpha, maskBorderRadius, maskFill, intro, outro, zoomTargetScale, dispatch])

    return (<>
        <div className={`flex px-4 pt-10 pb-4 gap-4 ${isOpen ? "" : "hidden"}`}>
            <span className="flex-1 text-sm text-base-content/70 flex items-center">
                Open a project from File Explorer or select a recent recording.
            </span>

            <Button
                className="btn-primary"
                onClick={findProject}
                disabled={isOpening}
                isLoading={isOpening}
                icon={DocumentMagnifyingGlassIcon}
            >
                Open project
            </Button>
            <div className={`join ${isOpen ? "" : "hidden"}`}>
                <Button
                    className="join-item"
                    onClick={() => setPage(page - 1)}
                    disabled={isPending || isError || projects.totalPages === 0 || page === 0}
                    icon={ChevronLeftIcon}
                />
                <Button
                    className="join-item"
                    onClick={() => setPage(page + 1)}
                    disabled={isPending || isError || projects.totalPages === 0 || page === projects.totalPages - 1}
                    icon={ChevronRightIcon}
                />
            </div>
        </div>
        {!isPending && !isError && projects.items.length > 0 &&
            <div className={`flex-1 flex flex-col gap-12 py-4 overflow-auto bg-base-100 rounded-lg ${isOpen ? "" : "hidden"}`}>
                <table className="table">
                    <thead>
                        <tr>
                            <th>Project name</th>
                            <th>Last updated</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {projects?.items.map(project => (<ProjectRow key={project.id} project={project}
                            refetch={refetch} />))}
                    </tbody>
                </table>
            </div>}
    </>)
}

Projects.propTypes = {
    isOpen: PropTypes.bool.isRequired
}