import PropTypes from "prop-types"
import {
    useEffect,
    useRef
} from "react"

export default function Toggle({ leftLabel, rightLabel, value, onChange, isIndeterminate, justifyBetween, disabled }) {

    const toggleRef = useRef(null)

    useEffect(() => {
        toggleRef.current.indeterminate = isIndeterminate ?? false
    }, [isIndeterminate])

    return (
        <label className={`fieldset-label w-full cursor-pointer ${(justifyBetween ?? true) ? 'justify-between' : 'gap-4'}`}>
            {leftLabel}
            <input ref={toggleRef} type="checkbox" className="toggle toggle-sm" checked={value} disabled={disabled}
                onChange={onChange} />
            {rightLabel}
        </label>
    )
}

Toggle.propTypes = {
    leftLabel: PropTypes.node,
    rightLabel: PropTypes.node,
    value: PropTypes.bool,
    onChange: PropTypes.func.isRequired,
    isIndeterminate: PropTypes.bool,
    justifyBetween: PropTypes.bool,
    disabled: PropTypes.bool
}