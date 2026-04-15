import { XMarkIcon } from "@heroicons/react/16/solid"
import { useHotkeys } from "react-hotkeys-hook"
import { useDispatch, useSelector } from "react-redux"
import Button from "../../../../components/Button"
import { selectIsProjectClosing, setIsProjectClosing } from "@shared/redux/appSlice"
import { selectAreHotkeysEnabled } from "@shared/redux/editorSlice"

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
            className="btn-ghost"
            disabled={isProjectClosing}
            isLoading={isProjectClosing}
            icon={XMarkIcon}
            size="xs"
        >
            <span className="hidden md:inline">Close</span>
        </Button>
    </>)
}

