import PropTypes from 'prop-types'

export default function Divider({ children }) {
    return (
        <div className="w-full">
            <div className="divider font-semibold text-sm">{children}</div>
        </div>)
}

Divider.propTypes = {
    children: PropTypes.node
}