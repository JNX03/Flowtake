import { XMarkIcon } from "@heroicons/react/24/outline"
import PropTypes from "prop-types"
import {
    useEffect,
    useRef
} from "react"
import { useHotkeys } from "react-hotkeys-hook"
import { useDispatch } from "react-redux"
import Button from "../../../components/Button"
import { setAreHotkeysEnabled } from "../../../src/redux/editorSlice"

export default function Modal({ title, isOpen, close, children, modalBoxClassNames }) {
    const dispatch = useDispatch()

    const dialogRef = useRef(null)

    useHotkeys('esc', close, { enabled: !!isOpen, enableOnFormTags: true })

    useEffect(() => { dispatch(setAreHotkeysEnabled(!isOpen)) }, [dispatch, isOpen])

    useEffect(() => {
        if (isOpen) dialogRef.current.focus()
    }, [isOpen])

    return (<dialog ref={dialogRef} className={`modal ${isOpen ? "modal-open" : ""}`} tabIndex={-1}>
        <div className={`modal-box flex flex-col min-h-0 max-h-10/12 ${modalBoxClassNames ? modalBoxClassNames : ""}`}>
            <Button icon={XMarkIcon} className="btn-sm btn-circle btn-ghost absolute right-2 top-2" onClick={close} />
            <h3 className="text-xl font-semibold mb-4">{title}</h3>
            {children}
        </div>
    </dialog>)
}

Modal.propTypes = {
    title: PropTypes.string.isRequired,
    isOpen: PropTypes.bool.isRequired,
    close: PropTypes.func.isRequired,
    children: PropTypes.node.isRequired,
    modalBoxClassNames: PropTypes.string
}