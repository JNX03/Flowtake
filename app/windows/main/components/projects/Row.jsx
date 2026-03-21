import {
    ArrowRightIcon,
    FolderIcon,
    TrashIcon
} from "@heroicons/react/24/outline"
import moment from "moment"
import PropTypes from 'prop-types'
import {
    useCallback,
    useMemo,
    useState
} from "react"
import {
    useDispatch,
    useSelector
} from "react-redux"
import Button from "../../../../components/Button"
import {
    openProject,
    TOAST_ERROR
} from "@shared/helpers"
import {
    addToast,
    setLoaderMessage
} from "@shared/redux/appSlice"
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

export default function ProjectRow({ project, refetch }) {

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

    const [isDeleteProcessing, setIsDeleteProcessing] = useState(false)
    const [isOpenProcessing, setIsOpenProcessing] = useState(false)
    const [isOpenDirectoryProcessing, setIsOpenDirectoryProcessing] = useState(false)

    const isProcessing = useMemo(
        () => isDeleteProcessing || isOpenProcessing,
        [isDeleteProcessing, isOpenProcessing])

    const openDirectory = useCallback(async () => {
        setIsOpenDirectoryProcessing(true)
        await window.electron.ipcRenderer.invoke("open-project-dir", project.id)
        setIsOpenDirectoryProcessing(false)
    }, [project.id])

    const open = useCallback(async () => {
        setIsOpenProcessing(true)
        dispatch(setLoaderMessage("Opening project..."))
        const actions = await openProject(project.id, false, layout, microphoneAudioVolume, systemAudioVolume,
            zoomBlurStrength, cameraZoomTargetScale, playbackRate, maskBlurStrength, maskAlpha, maskBorderRadius,
            maskFill, intro, outro, zoomTargetScale, refetch)
        actions.forEach(action => dispatch(action))
        setIsOpenProcessing(false)
    }, [dispatch, project.id, layout, microphoneAudioVolume, systemAudioVolume, zoomBlurStrength, cameraZoomTargetScale,
        playbackRate, maskBlurStrength, maskAlpha, maskBorderRadius, maskFill, intro, outro, zoomTargetScale, refetch])

    const deleteProject = useCallback(async () => {
        if (window.confirm("Are you sure?")) {
            setIsDeleteProcessing(true)
            const isDeleted = await window.electron.ipcRenderer.invoke("delete-project", project.id)
            if (isDeleted) refetch()
            else {
                dispatch(addToast({ type: TOAST_ERROR, text: "Project couldn't be deleted. Please try again later" }))
                setIsDeleteProcessing(false)
            }
        }
    }, [project.id, refetch, dispatch])

    return (
        <tr className="hover">
            <th className="max-w-96 text-ellipsis font-semibold text-nowrap overflow-hidden">{project.name || "Recording"}</th>
            <td>{project.lastSaved ? moment(project.lastSaved).fromNow() : ""}</td>
            <td className="flex justify-end gap-2">
                <Button
                    onClick={deleteProject}
                    className="btn-ghost"
                    disabled={isProcessing || isOpenDirectoryProcessing}
                    isLoading={isDeleteProcessing}
                    icon={TrashIcon}
                    tooltip="Delete"
                />
                <Button
                    onClick={openDirectory}
                    className="btn-ghost"
                    disabled={isProcessing || isOpenDirectoryProcessing}
                    isLoading={isOpenDirectoryProcessing}
                    icon={FolderIcon}
                    tooltip="Reveal in File Explorer"
                />
                <Button
                    onClick={open}
                    className="btn-primary"
                    disabled={isProcessing || isOpenDirectoryProcessing}
                    isLoading={isOpenProcessing}
                    icon={ArrowRightIcon}
                >
                    Open
                </Button>
            </td>
        </tr>
    )
}

ProjectRow.propTypes = {
    project: PropTypes.shape({
        id: PropTypes.string.isRequired,
        name: PropTypes.string,
        lastSaved: PropTypes.number
    }).isRequired,
    refetch: PropTypes.func.isRequired
}