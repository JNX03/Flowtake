import {
    AdjustmentsHorizontalIcon,
    DocumentPlusIcon,
    EllipsisHorizontalIcon,
    PlusIcon
} from "@heroicons/react/16/solid"
import { useQuery } from "@tanstack/react-query"
import {
    useCallback,
    useState
} from "react"
import {
    useDispatch,
    useStore
} from "react-redux"
import Button from "../../../../components/Button"
import {
    getPresettableData,
    TOAST_SUCCESS
} from "@shared/helpers"
import { addToast } from "@shared/redux/appSlice"
import Divider from "../contextMenus/Divider"
import TextInputModal from "../TextInputModal"
import Preset from "./Preset"
import PresetsModal from "./PresetsModal"

export default function PresetsDropdown() {

    const dispatch = useDispatch()

    const store = useStore()

    const [preset, setPreset] = useState(null)
    const [isRenameModalOpen, setIsRenameModalOpen] = useState(false)
    const [isAllPresetsModalOpen, setIsAllPresetsModalOpen] = useState(false)

    const { data: presets, isPending, isError, refetch } = useQuery({
        queryKey: ['presets'],
        queryFn: () => window.electron.ipcRenderer.invoke("store-get-paginated", "presets", 0, 10),
        staleTime: Infinity
    })

    const onSave = useCallback(async name => {
        await window.electron.ipcRenderer.invoke("save-preset", { ...preset, name })
        dispatch(addToast({ type: TOAST_SUCCESS, text: preset.name === "" ? "Preset created" : "Preset renamed" }))
        setPreset(null)
        refetch()
    }, [preset, dispatch, refetch])

    const onNew = useCallback(() => {
        const presentState = store.getState().undoableState.present
        setPreset({ name: "", ...getPresettableData(presentState) })
        setIsRenameModalOpen(true)
    }, [store])

    const onRename = useCallback(preset => {
        setPreset(preset)
        setIsRenameModalOpen(true)
    }, [])

    const onShowAll = useCallback(() => setIsAllPresetsModalOpen(true), [])

    const onImport = useCallback(async () => {
        const successful = await window.electron.ipcRenderer.invoke("import-preset")
        if (successful) {
            refetch()
            dispatch(addToast({ type: TOAST_SUCCESS, text: "Preset imported" }))
        }
    }, [refetch, dispatch])

    const closeRenameModal = useCallback(() => setIsRenameModalOpen(false), [])
    const closeAllPresetsModal = useCallback(() => setIsAllPresetsModalOpen(false), [])

    return (<>
        <div className="dropdown">
            <Button
                className="mt-1 btn-xs"
                onClick={() => { }}
                disabled={isPending || isError}
                isLoading={isPending}
                icon={AdjustmentsHorizontalIcon}
                size="xs"
            >
                Presets
            </Button>
            <ul className="dropdown-content menu menu-sm border-base-300/10 border-2 bg-base-300/70 backdrop-blur-md rounded-lg shadow-lg w-72 mt-2">
                {!isPending && !isError && <>
                    {presets.items.map((preset, i) =>
                        <Preset key={i} presetDescriptor={preset} onRename={onRename} onDirty={refetch} />)}
                    {presets.totalPages > 1 && <>
                        <Divider />
                        <li>
                            <button onClick={onShowAll}>
                                <EllipsisHorizontalIcon className="h-5 w-5" />
                                Show All
                            </button>
                        </li>
                    </>}
                </>}
                <Divider />
                <li><button onClick={onNew}><PlusIcon className="h-5 w-5" />New</button></li>
                <li><button onClick={onImport}><DocumentPlusIcon className="h-5 w-5" />Import</button></li>
            </ul>
        </div>
        <TextInputModal title={preset?.name ? "Rename preset" : "New preset"} label="Preset name"
            value={preset?.name || ""} isOpen={isRenameModalOpen} close={closeRenameModal}
            save={onSave} />
        <PresetsModal isOpen={isAllPresetsModalOpen && !isRenameModalOpen} onRename={onRename} onDirty={refetch}
            close={closeAllPresetsModal} />
    </>)
}