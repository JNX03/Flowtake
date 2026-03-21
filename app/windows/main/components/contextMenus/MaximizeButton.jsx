import { ArrowsRightLeftIcon } from "@heroicons/react/16/solid"
import PropTypes from 'prop-types'
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
    canMaximize,
    maximize
} from "@shared/helpers"
import {
    selectAreHotkeysEnabled,
    selectDuration,
    selectIsPlaying
} from "@shared/redux/editorSlice"
import { setSelectedIds } from "@shared/redux/timelineSlice"
import Item from "./Item"

export default function MaximizeButton({ close, configs, selectedConfigs, onMaximize }) {

    const dispatch = useDispatch()

    const areHotkeysEnabled = useSelector(selectAreHotkeysEnabled)
    const isPlaying = useSelector(selectIsPlaying)
    const duration = useSelector(selectDuration)

    const isEnabled = useMemo(
        () => selectedConfigs.length === 1 && canMaximize(duration, selectedConfigs[0], configs),
        [selectedConfigs, configs, duration]
    )

    const unselectAction = useCallback(() => dispatch(setSelectedIds([])), [dispatch])

    const onClick = useCallback(() => {
        close()
        onMaximize(maximize(duration, selectedConfigs[0], configs))
        unselectAction(false, true)
    }, [close, onMaximize, duration, selectedConfigs, configs, unselectAction])

    useHotkeys('f',
        () => onClick(),
        { enabled: areHotkeysEnabled && isEnabled && !isPlaying },
        [isEnabled, configs, selectedConfigs, onMaximize, areHotkeysEnabled, isPlaying, onClick])

    return (<Item text="Maximize" icon={ArrowsRightLeftIcon} isEnabled={isEnabled} onClick={onClick}
        kbd={<kbd className="kbd kbd-sm">f</kbd>} />)
}

MaximizeButton.propTypes = {
    close: PropTypes.func.isRequired,
    configs: PropTypes.array.isRequired,
    selectedConfigs: PropTypes.array.isRequired,
    onMaximize: PropTypes.func.isRequired
}