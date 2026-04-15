import {
    ArrowRightIcon,
    FolderIcon,
    TrashIcon
} from "@heroicons/react/24/outline"
import { ask } from "@tauri-apps/plugin-dialog"
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
import { openProject } from "@shared/helpers"
import { addErrorToast } from "@shared/errorToastHelper"
import { setLoaderMessage } from "@shared/redux/appSlice"
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
        const confirmed = await ask(`Delete "${project.name || "Recording"}"? This cannot be undone.`, {
            title: "Delete project",
            kind: "warning",
            okLabel: "Delete",
            cancelLabel: "Cancel"
        })
        if (!confirmed) return
        setIsDeleteProcessing(true)
        try {
            await window.electron.ipcRenderer.invoke("delete-project", project.id)
            await refetch()
        } catch (e) {
            console.error("[deleteProject]", e)
            dispatch(addErrorToast(`Couldn't delete project: ${e?.message || e}`))
        } finally {
            setIsDeleteProcessing(false)
        }
    }, [project.id, project.name, refetch, dispatch])

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