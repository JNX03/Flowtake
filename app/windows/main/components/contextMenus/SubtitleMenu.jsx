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
    selectIsSubtitleMenuOpen,
    setIsSubtitleMenuOpen
} from "@shared/redux/contextMenuSlice"
import {
    selectAreHotkeysEnabled,
    selectIsPlaying
} from "@shared/redux/editorSlice"
import {
    removeSubtitle,
    removeSubtitles,
    selectAllSubtitles,
    selectSubtitleEntities,
    updateSubtitle,
    upsertSubtitles
} from "@shared/redux/subtitleSlice"
import {
    selectSelectedIds,
    setSelectedIds
} from "@shared/redux/timelineSlice"
import SubtitleConfig from "@shared/scene/subtitle/SubtitleConfig"
import DeleteButton from "./DeleteButton"
import Divider from "./Divider"
import Item from "./Item"
import MaximizeButton from "./MaximizeButton"
import Menu from "./Menu"
import MergeLeftButton from "./MergeLeftButton"
import MergeRightButton from "./MergeRightButton"
import SelectAllButton from "./SelectAllButton"
import SplitButton from "./SplitButton"

export default function SubtitleMenu() {

    const dispatch = useDispatch()

    const isOpen = useSelector(selectIsSubtitleMenuOpen)
    const selectedIds = useSelector(selectSelectedIds)
    const configs = useSelector(selectAllSubtitles)
    const entities = useSelector(selectSubtitleEntities)
    const areHotkeysEnabled = useSelector(selectAreHotkeysEnabled)
    const isPlaying = useSelector(selectIsPlaying)

    const selectedConfigs = useMemo(
        () => selectedIds.map(id => entities[id]).filter(Boolean),
        [selectedIds, entities])

    const close = useCallback(() => dispatch(setIsSubtitleMenuOpen(false)), [dispatch])

    const onDelete = useCallback(() => {
        close()
        dispatch(removeSubtitles(selectedConfigs.map(({ id }) => id)))
        dispatch(setSelectedIds([]))
    }, [close, dispatch, selectedConfigs])

    const onSplit = configs => dispatch(upsertSubtitles(configs))

    const onMerge = ({ removeId, updateArgs }) => {
        dispatch(removeSubtitle(removeId))
        dispatch(updateSubtitle(updateArgs))
    }

    const onMaximize = updateArgs => dispatch(updateSubtitle(updateArgs))

    useHotkeys('delete', () => onDelete(),
        { enabled: areHotkeysEnabled && selectedConfigs.length >= 1 && !isPlaying },
        [selectedConfigs, areHotkeysEnabled, isPlaying, onDelete])

    return (
        <Menu isOpen={isOpen} close={close}>
            <SplitButton close={close} selectedConfigs={selectedConfigs} class={SubtitleConfig} onSplit={onSplit} />
            <MergeLeftButton close={close} configs={configs} selectedConfigs={selectedConfigs} onMerge={onMerge} />
            <MergeRightButton close={close} configs={configs} selectedConfigs={selectedConfigs} onMerge={onMerge} />
            <MaximizeButton close={close} configs={configs} selectedConfigs={selectedConfigs} onMaximize={onMaximize} />
            <Divider />
            <SelectAllButton close={close} />
            <Divider />
            <DeleteButton onDelete={onDelete} />
            <Divider />
            <Item text="Customize" icon={AdjustmentsHorizontalIcon} isEnabled={true} onClick={close} />
        </Menu>
    )
}