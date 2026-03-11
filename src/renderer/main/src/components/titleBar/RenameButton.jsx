import { PencilIcon } from "@heroicons/react/16/solid"
import { useState } from "react"
import { useHotkeys } from "react-hotkeys-hook"
import { useDispatch, useSelector } from "react-redux"
import { selectAreHotkeysEnabled } from "../../../../src/redux/editorSlice"
import { selectName, setName } from "../../../../src/redux/projectSlice"
import TextInputModal from "../TextInputModal"

export default function RenameButton() {

    const dispatch = useDispatch()

    const name = useSelector(selectName)
    const areHotkeysEnabled = useSelector(selectAreHotkeysEnabled)
    const [isOpen, setIsOpen] = useState(false)

    useHotkeys('f2', () => setIsOpen(true),
        { enabled: !isOpen && areHotkeysEnabled },
        [isOpen, areHotkeysEnabled])

    return (<>
        <button className="mt-1 btn btn-xs" onClick={() => setIsOpen(true)}>
            <PencilIcon className="size-4" />
            Rename
        </button>
        <TextInputModal title={"Rename project"} label="Project name" value={name} isOpen={isOpen}
            close={() => setIsOpen(false)} save={value => dispatch(setName(value))} />
    </>)
}

