import { XMarkIcon } from "@heroicons/react/16/solid"
import { useHotkeys } from "react-hotkeys-hook"
import { useDispatch, useSelector } from "react-redux"
import Button from "../../../../components/Button"
import { selectIsProjectClosing, setIsProjectClosing } from "../../../../src/redux/appSlice"
import { selectAreHotkeysEnabled } from "../../../../src/redux/editorSlice"

export default function CloseButton() {

    const dispatch = useDispatch()

    const areHotkeysEnabled = useSelector(selectAreHotkeysEnabled)
    const isProjectClosing = useSelector(selectIsProjectClosing)

    const closeProject = () => dispatch(setIsProjectClosing(true))

    useHotkeys('ctrl+w', closeProject,
        { enabled: !isProjectClosing && areHotkeysEnabled },
        [isProjectClosing, areHotkeysEnabled])

    return (<>
        <Button
            onClick={closeProject}
            className="mt-1"
            disabled={isProjectClosing}
            isLoading={isProjectClosing}
            icon={XMarkIcon}
            size="xs"
        >
            Close
        </Button>
    </>)
}

