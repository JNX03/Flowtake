import PropTypes from "prop-types"
import { useMemo } from "react"
import { getGroup } from "@shared/redux/actionEnhancers"

export default function ColorPicker({ initialValue, label, onChange, disabled = false }) {

    const group = useMemo(() => getGroup("color-picker"), [])

    return (<div className="flex items-center justify-between gap-2">
        <label htmlFor="color" className="fieldset-label">{label}</label>
        <input className="btn w-20 p-2" type="color" name="color" value={initialValue || "#ffffff"}
            onChange={({ target }) => onChange(target.value, group)} disabled={disabled} />
    </div>)
}

ColorPicker.propTypes = {
    initialValue: PropTypes.string,
    label: PropTypes.string,
    onChange: PropTypes.func,
    disabled: PropTypes.bool
}