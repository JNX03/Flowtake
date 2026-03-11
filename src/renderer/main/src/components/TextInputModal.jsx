import { CheckIcon } from "@heroicons/react/24/outline"
import PropTypes from 'prop-types'
import {
    useCallback,
    useRef,
    useState
} from "react"
import { useHotkeys } from "react-hotkeys-hook"
import Modal from "./Modal"

export default function TextInputModal({ title, label, value, isOpen, close, save }) {

    const inputRef = useRef(null)

    const [updatedValue, setUpdatedValue] = useState(value)

    const onSave = useCallback(() => {
        save(inputRef.current.value)
        close()
    }, [save, close])

    const onChange = useCallback(() => setUpdatedValue(inputRef.current.value), [])

    // Callback ref that focuses the input when it mounts
    const inputCallbackRef = useCallback((element) => {
        inputRef.current = element
        if (element && isOpen) setTimeout(() => element.focus(), 100)
    }, [isOpen])

    useHotkeys('enter', () => onSave(), { enabled: isOpen, enableOnFormTags: ["input"] })

    return (<Modal isOpen={isOpen} title={title} close={close}>
        <fieldset className="fieldset" key={isOpen ? value : 'closed'}>
            <legend className="fieldset-legend">{label}</legend>
            <input type="text" placeholder={label} required className="input validator w-full"
                value={updatedValue} onChange={onChange} ref={inputCallbackRef} />
            <div className="validator-hint">Cannot be empty</div>
        </fieldset>
        <div className="modal-action">
            <button className="btn btn-primary" disabled={updatedValue.length === 0} onClick={onSave}>
                <CheckIcon className="h-6 w-6" />
                Save
            </button>
        </div>
    </Modal>)
}

TextInputModal.propTypes = {
    title: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    value: PropTypes.string.isRequired,
    isOpen: PropTypes.bool.isRequired,
    close: PropTypes.func.isRequired,
    save: PropTypes.func.isRequired
}