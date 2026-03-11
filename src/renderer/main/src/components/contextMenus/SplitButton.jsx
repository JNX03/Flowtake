import { ScissorsIcon } from "@heroicons/react/16/solid"
import PropTypes from "prop-types"
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
    canSplit,
    split
} from "../../../../src/helpers"
import {
    selectAreHotkeysEnabled,
    selectIsPlaying
} from "../../../../src/redux/editorSlice"
import {
    selectSelectedIds,
    selectTime,
    setSelectedIds
} from "../../../../src/redux/timelineSlice"
import Item from "./Item"

export default function SplitButton({ close, selectedConfigs, class: Class, onSplit }) {

    const dispatch = useDispatch()

    const areHotkeysEnabled = useSelector(selectAreHotkeysEnabled)
    const selectedIds = useSelector(selectSelectedIds)
    const isPlaying = useSelector(selectIsPlaying)
    const time = useSelector(selectTime)

    const isEnabled = useMemo(
        () => selectedConfigs.length === 1 && canSplit(selectedConfigs[0], time),
        [selectedConfigs, time])

    const unselectAction = useCallback(() => dispatch(setSelectedIds([])), [dispatch])

    const onClick = useCallback(() => {
        close()
        onSplit(split(selectedConfigs[0], Class, time))
        unselectAction()
    }, [close, onSplit, selectedConfigs, Class, time, unselectAction])

    useHotkeys('s',
        () => onClick(),
        { enabled: areHotkeysEnabled && selectedIds.length === 1 && isEnabled && !isPlaying },
        [isEnabled, selectedIds, onSplit, areHotkeysEnabled, isPlaying, onClick])

    return (<Item text="Split at time cursor" icon={ScissorsIcon} isEnabled={isEnabled} onClick={onClick}
        kbd={<kbd className="kbd kbd-sm">s</kbd>} />)
}

SplitButton.propTypes = {
    close: PropTypes.func.isRequired,
    selectedConfigs: PropTypes.array.isRequired,
    class: PropTypes.func,
    onSplit: PropTypes.func.isRequired
}