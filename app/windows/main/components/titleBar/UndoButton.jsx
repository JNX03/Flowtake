import { ArrowUturnLeftIcon } from "@heroicons/react/16/solid"
import { useHotkeys } from "react-hotkeys-hook"
import { useDispatch, useSelector } from "react-redux"
import { ActionCreators } from "redux-undo"
import { selectAreHotkeysEnabled } from "@shared/redux/editorSlice"

export default function UndoButton() {

    const dispatch = useDispatch()

    const past = useSelector(state => state.undoableState.past)
    const areHotkeysEnabled = useSelector(selectAreHotkeysEnabled)

    const undo = () => dispatch(ActionCreators.undo())

    useHotkeys('ctrl+z', undo, { enabled: areHotkeysEnabled, enableOnFormTags: true }, [areHotkeysEnabled])

    return (<button className="btn btn-ghost btn-xs btn-square" onClick={undo} disabled={past.length === 0}>
        <ArrowUturnLeftIcon className="size-4" />
    </button>)
}

