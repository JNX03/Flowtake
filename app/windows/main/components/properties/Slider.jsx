import PropTypes from "prop-types"
import {
    useCallback,
    useMemo
} from "react"

export default function Slider({ min = 0, max = 1, step, value, isIndeterminate = false, onChange, label, format,
    disabled = false, showSteps = false }) {

    const actualStep = useMemo(() => step ?? (max - min) / 100, [step, max, min])

    const onChangeValue = useCallback(({ target }) => { onChange(Number(target.value)) }, [onChange])

    return (<>
        <label className="fieldset-label flex justify-between">
            <span>{label}</span>
            {!isIndeterminate && <span>{format?.(value) || value}</span>}
        </label>
        <input type="range" min={min} max={max} value={value} step={actualStep} disabled={disabled}
            onChange={onChangeValue} className={`range range-sm w-full ${disabled ? "cursor-default" : ""}`} />
        {showSteps && <div className="flex justify-between px-2.5 text-xs">
            {Array.from({ length: (max - min + 1) / actualStep }).map((_, i) => (<span key={i}>|</span>))}
        </div>}
    </>)
}

Slider.propTypes = {
    min: PropTypes.number,
    max: PropTypes.number,
    step: PropTypes.number,
    value: PropTypes.number.isRequired,
    isIndeterminate: PropTypes.bool,
    onChange: PropTypes.func.isRequired,
    label: PropTypes.string,
    format: PropTypes.func,
    disabled: PropTypes.bool,
    showSteps: PropTypes.bool
}