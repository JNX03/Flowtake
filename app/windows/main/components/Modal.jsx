import { XMarkIcon } from "@heroicons/react/24/outline"
import PropTypes from "prop-types"
import {
    useEffect,
    useId,
    useRef
} from "react"
import { useDispatch } from "react-redux"
import Button from "../../../components/Button"
import { setAreHotkeysEnabled } from "@shared/redux/editorSlice"

export default function Modal({ title, isOpen, close, children, modalBoxClassNames }) {
    const dispatch = useDispatch()
    const dialogRef = useRef(null)
    const previousFocusRef = useRef(null)
    const titleId = useId()

    useEffect(() => { dispatch(setAreHotkeysEnabled(!isOpen)) }, [dispatch, isOpen])

    useEffect(() => {
        if (!isOpen) return undefined

        const dialog = dialogRef.current
        if (!dialog) return undefined

        previousFocusRef.current = document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null
        if (!dialog.open) dialog.showModal()
        dialog.focus()

        return () => {
            if (dialog.open) dialog.close()
            const previousFocus = previousFocusRef.current
            if (previousFocus?.isConnected) previousFocus.focus()
            previousFocusRef.current = null
        }
    }, [isOpen])

    const handleCancel = event => {
        event.preventDefault()
        close()
    }

    return (<dialog
        ref={dialogRef}
        className={`modal ${isOpen ? "modal-open" : ""}`}
        tabIndex={-1}
        aria-labelledby={titleId}
        onCancel={handleCancel}
    >
        <div className={`modal-box flex flex-col min-h-0 max-h-10/12 ${modalBoxClassNames ? modalBoxClassNames : ""}`}>
            <Button
                icon={XMarkIcon}
                className="btn-sm btn-circle btn-ghost absolute right-2 top-2"
                onClick={close}
                aria-label={`Close ${title}`}
            />
            <h3 id={titleId} className="text-xl font-semibold mb-4">{title}</h3>
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
