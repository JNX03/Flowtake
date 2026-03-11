import {
    DocumentArrowUpIcon,
    DocumentCheckIcon,
    FolderOpenIcon,
    PencilIcon,
    TrashIcon
} from "@heroicons/react/16/solid"
import PropTypes from 'prop-types'
import {
    useCallback,
    useState
} from "react"
import {
    useDispatch,
    useStore
} from "react-redux"
import {
    getPresettableData,
    TOAST_ERROR,
    TOAST_SUCCESS
} from "../../../../src/helpers"
import {
    getGroup,
    withGroup
} from "../../../../src/redux/actionEnhancers"
import { addToast } from "../../../../src/redux/appSlice"
import {
    applyProperties as applyCameraZoomAnimsProperties,
    updateAllCameraZooms
} from "../../../../src/redux/cameraZoomSlice"
import {
    applyProperties as applyClickAnimsProperties
} from "../../../../src/redux/clickSlice"
import {
    applyProperties as applyClipAnimsProperties,
    updateAllClips
} from "../../../../src/redux/clipSlice"
import {
    applyProperties as applyCursorCoordsProperties
} from "../../../../src/redux/cursorCoordsSlice"
import {
    applyProperties as applyCursorTypeAnimsProperties
} from "../../../../src/redux/cursorTypeSlice"
import {
    applyProperties as applyMaskAnimsProperties,
    updateAllMasks
} from "../../../../src/redux/maskSlice"
import {
    applyProperties as applyPanAnimsProperties,
    updateAllPans
} from "../../../../src/redux/panSlice"
import {
    applyProperties as applyProjectProperties
} from "../../../../src/redux/projectSlice"
import {
    applyProperties as applySubtitleAnimsProperties
} from "../../../../src/redux/subtitleSlice"
import {
    applyProperties as applyZoomAnimsProperties,
    updateAllZooms
} from "../../../../src/redux/zoomSlice"

export default function Preset({ presetDescriptor, onRename, onDirty }) {

    const dispatch = useDispatch()

    const store = useStore()

    const [isBusy, setIsBusy] = useState(false)

    const onClickDelete = useCallback(async () => {
        if (window.confirm("Are you sure?")) {
            setIsBusy(true)
            const isDeleted = await window.electron.ipcRenderer.invoke("delete-preset", presetDescriptor.id)
            setIsBusy(false)
            if (isDeleted) {
                onDirty()
                dispatch(addToast({ type: TOAST_SUCCESS, text: "Preset deleted" }))
            } else dispatch(addToast({ type: TOAST_ERROR, text: "Preset couldn't be deleted. Please try again later" }))
        }
    }, [presetDescriptor.id, onDirty, dispatch])

    const onClickUpdate = useCallback(async () => {
        setIsBusy(true)
        const presentState = store.getState().undoableState.present
        await window.electron.ipcRenderer.invoke("save-preset", { ...presetDescriptor, ...getPresettableData(presentState) })
        setIsBusy(false)
        onDirty()
        dispatch(addToast({ type: TOAST_SUCCESS, text: "Preset updated" }))
    }, [presetDescriptor, onDirty, store, dispatch])

    const openPresetDir = useCallback(() => {
        window.electron.ipcRenderer.invoke("open-preset-dir", presetDescriptor.id)
    }, [presetDescriptor.id])

    const filterEmptyProperties = useCallback(obj => {
        const cleanedUpObj = {}
        Object.entries(obj).forEach(([key, value]) => {
            if (value != null && key !== "entities") cleanedUpObj[key] = value
        })
        return cleanedUpObj
    }, [])

    const onClickRename = useCallback(() => {
        onRename(presetDescriptor)
    }, [onRename, presetDescriptor])

    const onApply = useCallback(async () => {
        setIsBusy(true)
        const fullPreset = await window.electron.ipcRenderer.invoke("get-preset", presetDescriptor.id)
        if (fullPreset) {
            // fix incomplete preset
            const properties = {
                project: {},
                clipAnims: {},
                clickAnims: {},
                cursorTypeAnims: {},
                subtitleAnims: {},
                panAnims: {},
                zoomAnims: {},
                cameraZoomAnims: {},
                cursorCoords: {},
                maskAnims: {},
                ...fullPreset
            }
            delete properties.name
            delete properties.id

            const group = getGroup("preset")
            dispatch(withGroup(applyProjectProperties({ ...properties.project }), group))
            dispatch(withGroup(applyClipAnimsProperties({ ...properties.clipAnims }), group))
            dispatch(withGroup(applyClickAnimsProperties({ ...properties.clickAnims }), group))
            dispatch(withGroup(applyCursorTypeAnimsProperties({ ...properties.cursorTypeAnims }), group))
            dispatch(withGroup(applySubtitleAnimsProperties({ ...properties.subtitleAnims }), group))
            dispatch(withGroup(applyPanAnimsProperties({ ...properties.panAnims }), group))
            dispatch(withGroup(applyZoomAnimsProperties({ ...properties.zoomAnims }), group))
            dispatch(withGroup(applyCameraZoomAnimsProperties({ ...properties.cameraZoomAnims }), group))
            dispatch(withGroup(applyCursorCoordsProperties({ ...properties.cursorCoords }), group))
            dispatch(withGroup(applyMaskAnimsProperties({ ...properties.maskAnims }), group))

            dispatch(withGroup(updateAllZooms({ changes: filterEmptyProperties(properties.zoomAnims) }), group))
            dispatch(withGroup(updateAllPans({ changes: filterEmptyProperties(properties.zoomAnims) }), group))
            dispatch(withGroup(updateAllCameraZooms({ changes: filterEmptyProperties(properties.cameraZoomAnims) }), group))
            dispatch(withGroup(updateAllClips({ changes: filterEmptyProperties(properties.clipAnims) }), group))
            dispatch(withGroup(updateAllMasks({ changes: filterEmptyProperties(properties.maskAnims) }), group))

            dispatch(addToast({ type: TOAST_SUCCESS, text: "Preset applied" }))
        } else onDirty()
        setIsBusy(false)
    }, [presetDescriptor.id, filterEmptyProperties, dispatch, onDirty])

    return (<li className={`flex-row gap-1 max-w-full group ${isBusy ? "menu-disabled" : ""}`}>
        <button className="flex-1" onClick={onApply} disabled={isBusy}>
            <DocumentCheckIcon className="h-5 w-5" />
            <span className="text-ellipsis text-nowrap overflow-hidden">{presetDescriptor.name}</span>
        </button>
        <button className="px-1 hidden group-hover:block tooltip tooltip-bottom" disabled={isBusy} data-tip="Rename"
            onClick={onClickRename}>
            <PencilIcon className="size-4" />
        </button>
        <button className="px-1 hidden group-hover:block tooltip tooltip-bottom" disabled={isBusy} data-tip="Update"
            onClick={onClickUpdate}>
            <DocumentArrowUpIcon className="size-4" />
        </button>
        <button className="px-1 hidden group-hover:block tooltip tooltip-bottom" disabled={isBusy} data-tip="Share"
            onClick={openPresetDir}>
            <FolderOpenIcon className="size-4" />
        </button>
        <button className="px-1 hidden group-hover:block tooltip tooltip-bottom" disabled={isBusy} data-tip="Delete"
            onClick={onClickDelete}>
            <TrashIcon className="size-4" />
        </button>
    </li>)
}

Preset.propTypes = {
    presetDescriptor: PropTypes.shape({
        id: PropTypes.string.isRequired,
        name: PropTypes.string.isRequired
    }).isRequired,
    onRename: PropTypes.func.isRequired,
    onDirty: PropTypes.func.isRequired
}