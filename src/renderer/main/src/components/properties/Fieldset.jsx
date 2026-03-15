import PropTypes from 'prop-types'

export default function Fieldset({ legend, description, children }) {
    return (<fieldset
        className={`fieldset bg-base-200/50 border border-base-content/5 ${description ? "px-4 pb-4" : "p-4"} rounded-box`}>
        {description && <span className="mb-4">{description}</span>}
        {legend && <legend className="fieldset-legend">{legend}</legend>}
        {children}
    </fieldset>)
}

Fieldset.propTypes = {
    legend: PropTypes.string,
    description: PropTypes.string,
    children: PropTypes.node
}