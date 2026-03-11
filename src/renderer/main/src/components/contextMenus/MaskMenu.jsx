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
    selectIsMaskMenuOpen,
    selectSelectedMaskRow,
    setIsMaskMenuOpen,
    setSelectedMaskRow
} from "../../../../src/redux/contextMenuSlice"
import {
    selectAreHotkeysEnabled,
    selectIsPlaying
} from "../../../../src/redux/editorSlice"
import {
    removeMask,
    removeMasks,
    selectAllMasks,
    selectMaskEntities,
    updateMask,
    upsertMasks
} from "../../../../src/redux/maskSlice"
import {
    selectSelectedIds,
    setSelectedIds
} from "../../../../src/redux/timelineSlice"
import MaskConfig from "../../../../src/scene/mask/MaskConfig"
import DeleteButton from "./DeleteButton"
import Divider from "./Divider"
import Item from "./Item"
import MaximizeButton from "./MaximizeButton"
import Menu from "./Menu"
import MergeLeftButton from "./MergeLeftButton"
import MergeRightButton from "./MergeRightButton"
import SelectAllButton from "./SelectAllButton"
import SplitButton from "./SplitButton"

export default function MaskMenu() {

    const dispatch = useDispatch()

    const isOpen = useSelector(selectIsMaskMenuOpen)
    const selectedIds = useSelector(selectSelectedIds)
    const configs = useSelector(selectAllMasks)
    const entities = useSelector(selectMaskEntities)
    const areHotkeysEnabled = useSelector(selectAreHotkeysEnabled)
    const isPlaying = useSelector(selectIsPlaying)
    const selectedMaskRow = useSelector(selectSelectedMaskRow)

    const selectedConfigs = useMemo(
        () => selectedIds.map(id => entities[id]).filter(Boolean),
        [selectedIds, entities])

    const close = useCallback(() => {
        dispatch(setIsMaskMenuOpen(false))
        dispatch(setSelectedMaskRow(null))
    }, [dispatch])

    const onDelete = useCallback(() => {
        close()
        dispatch(removeMasks(selectedIds))
        dispatch(setSelectedIds([]))
    }, [close, dispatch, selectedIds])

    const onSplit = useCallback(configs => dispatch(upsertMasks(configs)), [dispatch])

    const onMerge = useCallback(({ removeId, updateArgs }) => {
        dispatch(removeMask(removeId))
        dispatch(updateMask(updateArgs))
    }, [dispatch])

    const onMaximize = useCallback(updateArgs => dispatch(updateMask(updateArgs)), [dispatch])

    const filterRow = useCallback(configs => configs.filter(config => config.row === selectedMaskRow).sort((a, b) => a.start - b.start), [selectedMaskRow])

    const allSelectedConfigsInSameRow = useCallback(() => selectedConfigs.every(config => config.row === selectedMaskRow), [selectedConfigs, selectedMaskRow])

    useHotkeys('delete', () => onDelete(),
        { enabled: areHotkeysEnabled && selectedConfigs.length >= 1 && !isPlaying },
        [selectedConfigs, areHotkeysEnabled, isPlaying])

    return (
        <Menu isOpen={isOpen && selectedMaskRow !== null} close={close}>
            <SplitButton close={close} selectedConfigs={selectedConfigs} class={MaskConfig} onSplit={onSplit} />
            <MergeLeftButton close={close} configs={filterRow(configs)} selectedConfigs={selectedConfigs} disabled={!allSelectedConfigsInSameRow()} onMerge={onMerge} />
            <MergeRightButton close={close} configs={filterRow(configs)} selectedConfigs={selectedConfigs} disabled={!allSelectedConfigsInSameRow()} onMerge={onMerge} />
            <MaximizeButton close={close} configs={filterRow(configs)} selectedConfigs={selectedConfigs} onMaximize={onMaximize} />
            <Divider />
            <SelectAllButton close={close} />
            <Divider />
            <DeleteButton onDelete={onDelete} />
            <Divider />
            <Item text="Customize" icon={AdjustmentsHorizontalIcon} isEnabled={true} onClick={close} />
        </Menu >
    )
}