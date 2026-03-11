import {
    ArrowRightIcon,
    XMarkIcon
} from "@heroicons/react/24/outline"
import PropTypes from 'prop-types'
import Button from "../../../../components/Button"
import Modal from "../Modal"

export default function RecordModal({ isOpen, onCancel, onRecord }) {

    return (
        <Modal title="Exports running in the background" isOpen={isOpen} close={onCancel}>
            There are exports currently running in the background. Recording performance might be affected significantly.

            <div className="modal-action">
                <Button onClick={onCancel} icon={XMarkIcon}>
                    Cancel
                </Button>
                <Button className="btn-primary" onClick={onRecord} icon={ArrowRightIcon}>
                    Record anyway
                </Button>
            </div>
        </Modal>
    )
}

RecordModal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onCancel: PropTypes.func.isRequired,
    onRecord: PropTypes.func.isRequired
}