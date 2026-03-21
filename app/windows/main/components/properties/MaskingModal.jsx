import { CursorArrowRaysIcon } from "@heroicons/react/24/outline"
import PropTypes from "prop-types"
import { useState } from "react"
import {
    useDispatch,
    useSelector
} from "react-redux"
import Button from "../../../../components/Button"
import {
    selectMaskById,
    updateMask
} from "@shared/redux/maskSlice"
import AreaSelectorModal from "./AreaSelectorModal"

export default function MaskingModal({ id, disabled }) {

    const dispatch = useDispatch()

    const mask = useSelector(state => selectMaskById(state, id))

    const [isModalOpen, setIsModalOpen] = useState(false)

    const toggleModal = () => setIsModalOpen(!isModalOpen)

    const save = (left, right, top, bottom) => {
        dispatch(updateMask({
            id: mask.id,
            changes: { left, right, top, bottom }
        }))
    }

    return (<>
        <Button icon={CursorArrowRaysIcon} onClick={toggleModal} disabled={disabled}>Select area</Button>
        {!disabled && mask && <AreaSelectorModal
            isOpen={isModalOpen}
            initialLeft={mask.left}
            initialRight={mask.right}
            initialTop={mask.top}
            initialBottom={mask.bottom}
            onClose={toggleModal}
            onSave={save}
            title="Select area"
        />}
    </>)
}

MaskingModal.propTypes = {
    id: PropTypes.string,
    disabled: PropTypes.bool.isRequired
}