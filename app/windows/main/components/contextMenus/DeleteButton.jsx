import { TrashIcon } from "@heroicons/react/16/solid"
import PropTypes from 'prop-types'
import Item from "./Item"

export default function DeleteButton({ onDelete }) {
    return (<Item text="Delete" icon={TrashIcon} isEnabled={true} onClick={onDelete}
        kbd={<kbd className="kbd kbd-sm">del</kbd>} />)
}

DeleteButton.propTypes = {
    onDelete: PropTypes.func.isRequired
}