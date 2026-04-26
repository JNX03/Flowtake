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
import { openProject } from "@shared/helpers"
import { withPreventUndo } from "@shared/redux/actionEnhancers"
import { selectTargetScale as selectCameraZoomTargetScale } from "@shared/redux/cameraZoomSlice"
import {
    selectLayout,
    selectMicrophoneAudioVolume,
    selectPlaybackRate,
    selectSystemAudioVolume
} from "@shared/redux/clipSlice"
import {
    selectAlpha,
    selectBorderRadius,
    selectFill,
    selectBlurStrength as selectMaskBlurStrength
} from "@shared/redux/maskSlice"
import {
    selectIntro,
    selectOutro,
    selectBlurStrength as selectZoomBlurStrength,
    selectTargetScale as selectZoomTargetScale
} from "@shared/redux/zoomSlice"
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
            actions.forEach(action => dispatch(withPreventUndo(action)))
        }
        setIsOpening(false)
    }, [layout, microphoneAudioVolume, systemAudioVolume, zoomBlurStrength, cameraZoomTargetScale, playbackRate,
        maskBlurStrength, maskAlpha, maskBorderRadius, maskFill, intro, outro, zoomTargetScale, dispatch])

    return (<>
        <div className={`h-full flex flex-col gap-3 min-h-0 ${isOpen ? "" : "hidden"}`}>
            {/* Actions bar */}
            <div className="flex items-center gap-3 flex-shrink-0">
                <Button
                    className="btn-primary btn-sm"
                    onClick={findProject}
                    disabled={isOpening}
                    isLoading={isOpening}
                    icon={DocumentMagnifyingGlassIcon}
                    size="sm"
                >
                    Open project
                </Button>
                <div className="flex-1" />
                <div className="join">
                    <Button
                        className="join-item btn-sm"
                        onClick={() => setPage(page - 1)}
                        disabled={isPending || isError || projects?.totalPages === 0 || page === 0}
                        icon={ChevronLeftIcon}
                        size="sm"
                    />
                    <Button
                        className="join-item btn-sm"
                        onClick={() => setPage(page + 1)}
                        disabled={isPending || isError || projects?.totalPages === 0 || page === (projects?.totalPages ?? 1) - 1}
                        icon={ChevronRightIcon}
                        size="sm"
                    />
                </div>
            </div>

            {/* Projects list */}
            <div className="flex-1 min-h-0 overflow-y-auto">
                {isPending && (
                    <div className="flex items-center justify-center py-16">
                        <span className="loading loading-spinner loading-md text-primary/40"></span>
                    </div>
                )}
                {!isPending && !isError && projects?.items?.length > 0 && (
                    <div className="rounded-xl overflow-hidden bg-base-200/30 border border-base-content/5">
                        <table className="table table-sm">
                            <thead>
                                <tr className="border-b border-base-content/5">
                                    <th className="text-base-content/40 font-normal text-xs">Project name</th>
                                    <th className="text-base-content/40 font-normal text-xs">Last updated</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {projects?.items.map(project => (
                                    <ProjectRow key={project.id} project={project} refetch={refetch} />
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                {!isPending && !isError && (!projects?.items || projects.items.length === 0) && (
                    <div className="h-full flex flex-col items-center justify-center gap-3">
                        <DocumentMagnifyingGlassIcon className="size-10 text-base-content/10" />
                        <p className="text-sm text-base-content/30">No projects yet</p>
                        <p className="text-xs text-base-content/20">Record your first screen capture to get started</p>
                    </div>
                )}
            </div>
        </div>
    </>)
}

Projects.propTypes = {
    isOpen: PropTypes.bool.isRequired
}
