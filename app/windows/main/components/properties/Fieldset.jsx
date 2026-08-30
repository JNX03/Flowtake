import PropTypes from 'prop-types'

export default function Fieldset({ id, legend, description, children }) {
    return (
        <section id={id} className="flowtake-fieldset flex flex-col">
            {legend && (
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-base-content/60 mb-2">
                    {legend}
                </h3>
            )}
            {description && <p className="text-xs text-base-content/60 mb-3">{description}</p>}
            <div className="flex flex-col gap-3">
                {children}
            </div>
        </section>
    )
}

Fieldset.propTypes = {
    id: PropTypes.string,
    legend: PropTypes.string,
    description: PropTypes.string,
    children: PropTypes.node
}
