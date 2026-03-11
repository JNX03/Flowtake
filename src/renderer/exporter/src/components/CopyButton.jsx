import { ClipboardIcon } from "@heroicons/react/24/outline"
import PropTypes from "prop-types"
import Button from "../../../components/Button"

export default function CopyButton({ value, tooltip, disabled, isLoading, className }) {

    const copy = () => navigator.clipboard.writeText(value)

    return (<Button icon={ClipboardIcon} className={className ?? ""} tooltip={tooltip ?? "Copy"} disabled={disabled}
        isLoading={isLoading} onClick={copy} />)
}

CopyButton.propTypes = {
    value: PropTypes.string.isRequired,
    tooltip: PropTypes.string,
    disabled: PropTypes.bool,
    isLoading: PropTypes.bool,
    className: PropTypes.string
}
