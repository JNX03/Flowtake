import {
    ArrowLeftIcon,
    ArrowLongLeftIcon
} from "@heroicons/react/16/solid"
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
    canMergeLeft,
    mergeLeft
} from "../../../../src/helpers"
import {
    selectAreHotkeysEnabled,
    selectIsPlaying
} from "../../../../src/redux/editorSlice"
import {
    setSelectedIds
} from "../../../../src/redux/timelineSlice"
import Item from "./Item"

export default function MergeLeftButton({ close, configs, selectedConfigs, onMerge, disabled = false }) {

    const dispatch = useDispatch()

    const areHotkeysEnabled = useSelector(selectAreHotkeysEnabled)
    const isPlaying = useSelector(selectIsPlaying)

    const isEnabled = useMemo(
        () => !disabled && selectedConfigs.length === 1 && canMergeLeft(selectedConfigs[0], configs),
        [selectedConfigs, configs, disabled]
    )

    const unselectAction = useCallback(() => dispatch(setSelectedIds([])), [dispatch])

    const onClick = useCallback(() => {
        close()
        onMerge(mergeLeft(selectedConfigs[0], configs))
        unselectAction(false, true)
    }, [close, onMerge, selectedConfigs, configs, unselectAction])

    useHotkeys('m+left',
        () => onClick(),
        { enabled: areHotkeysEnabled && isEnabled && !isPlaying },
        [isEnabled, selectedConfigs, configs, onMerge, areHotkeysEnabled, isPlaying, onClick])

    return (<Item text="Merge left" icon={ArrowLeftIcon} isEnabled={isEnabled} onClick={onClick}
        kbd={<>
            <kbd className="kbd kbd-sm">m</kbd>
            <kbd className="kbd kbd-sm"><ArrowLongLeftIcon className="size-4" /></kbd>
        </>} />)
}

MergeLeftButton.propTypes = {
    close: PropTypes.func.isRequired,
    configs: PropTypes.array.isRequired,
    selectedConfigs: PropTypes.array.isRequired,
    onMerge: PropTypes.func.isRequired,
    disabled: PropTypes.bool
}