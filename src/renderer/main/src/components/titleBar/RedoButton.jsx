import { ArrowUturnRightIcon } from '@heroicons/react/16/solid'
import { useHotkeys } from "react-hotkeys-hook"
import { useDispatch, useSelector } from "react-redux"
import { ActionCreators } from "redux-undo"
import { selectAreHotkeysEnabled } from "../../../../src/redux/editorSlice"

export default function RedoButton() {

    const dispatch = useDispatch()

    const future = useSelector(state => state.undoableState.future)
    const areHotkeysEnabled = useSelector(selectAreHotkeysEnabled)

    const redo = () => dispatch(ActionCreators.redo())

    useHotkeys('ctrl+y', redo, { enabled: areHotkeysEnabled, enableOnFormTags: true }, [areHotkeysEnabled, future])

    return (<button className="mt-1 btn btn-xs btn-square" onClick={redo} disabled={future.length === 0}>
        <ArrowUturnRightIcon className="size-4" />
    </button>)
}

