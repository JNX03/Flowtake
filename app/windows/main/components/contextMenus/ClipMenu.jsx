import { AdjustmentsHorizontalIcon } from "@heroicons/react/16/solid"
import {
    useCallback,
    useMemo
} from "react"
import { useHotkeys } from "react-hotkeys-hook"
import {
    useDispatch,
    useSelector
} from "react-redux"
import {
    TOAST_WARNING
} from "@shared/helpers"
import { addToast } from "@shared/redux/appSlice"
import {
    removeClip,
    removeClips,
    selectAllClips,
    selectClipEntities,
    selectTotalClips,
    updateClip,
    upsertClips
} from "@shared/redux/clipSlice"
import {
    selectIsClipMenuOpen,
    setIsClipMenuOpen,
} from "@shared/redux/contextMenuSlice"
import {
    selectAreHotkeysEnabled,
    selectIsPlaying
} from "@shared/redux/editorSlice"
import {
    selectSelectedIds,
    setSelectedIds
} from "@shared/redux/timelineSlice"
import ClipConfig from "@shared/scene/clip/ClipConfig"
import DeleteButton from "./DeleteButton"
import Divider from "./Divider"
import Item from "./Item"
import MaximizeButton from "./MaximizeButton"
import Menu from "./Menu"
import MergeLeftButton from "./MergeLeftButton"
import MergeRightButton from "./MergeRightButton"
import SelectAllButton from "./SelectAllButton"
import SplitButton from "./SplitButton"

export default function ClipMenu() {

    const dispatch = useDispatch()

    const isOpen = useSelector(selectIsClipMenuOpen)
    const selectedIds = useSelector(selectSelectedIds)
    const configs = useSelector(selectAllClips)
    const entities = useSelector(selectClipEntities)
    const totalConfigs = useSelector(selectTotalClips)
    const areHotkeysEnabled = useSelector(selectAreHotkeysEnabled)
    const isPlaying = useSelector(selectIsPlaying)

    const selectedConfigs = useMemo(
        () => selectedIds.map(id => entities[id]).filter(Boolean),
        [selectedIds, entities])

    const close = useCallback(() => dispatch(setIsClipMenuOpen(false)), [dispatch])

    const onDelete = useCallback(() => {
        close()
        if (selectedConfigs.length === totalConfigs)
            dispatch(addToast({ type: TOAST_WARNING, text: "Can't delete the last clip" }))
        else
            dispatch(removeClips(selectedConfigs.map(({ id }) => id)))

        dispatch(setSelectedIds([]))
    }, [close, selectedConfigs, totalConfigs, dispatch])

    const onSplit = useCallback(configs => dispatch(upsertClips(configs)), [dispatch])

    const onMerge = useCallback(({ removeId, updateArgs }) => {
        dispatch(removeClip(removeId))
        dispatch(updateClip(updateArgs))
    }, [dispatch])

    const onMaximize = useCallback(updateArgs => dispatch(updateClip(updateArgs)), [dispatch])

    useHotkeys('delete', () => onDelete(),
        { enabled: areHotkeysEnabled && selectedConfigs.length >= 1 && !isPlaying },
        [selectedConfigs, areHotkeysEnabled, isPlaying])

    return (
        <Menu isOpen={isOpen} close={close}>
            <SplitButton close={close} selectedConfigs={selectedConfigs} class={ClipConfig} onSplit={onSplit} />
            <MergeLeftButton close={close} configs={configs} selectedConfigs={selectedConfigs} onMerge={onMerge} />
            <MergeRightButton close={close} configs={configs} selectedConfigs={selectedConfigs} onMerge={onMerge} />
            <MaximizeButton close={close} configs={configs} selectedConfigs={selectedConfigs} onMaximize={onMaximize} />
            <Divider />
            <SelectAllButton close={close} />
            <Divider />
            <DeleteButton onDelete={onDelete} />
            <Divider />
            <Item text="Customize" icon={AdjustmentsHorizontalIcon} isEnabled={true} onClick={close} />
        </Menu >
    )
}