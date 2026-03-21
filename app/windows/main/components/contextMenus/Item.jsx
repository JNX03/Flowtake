import PropTypes from 'prop-types'

export default function Item({ text, icon: Icon, isEnabled, onClick, kbd }) {
    
    const onClickButton = () => {
        if (isEnabled) onClick()
    }

    return (
        <li className={isEnabled ? "" : "menu-disabled"}><a onClick={onClickButton}>
            <Icon className="size-4" />{text}{kbd}
        </a></li>
    )
}

Item.propTypes = {
    text: PropTypes.string.isRequired,
    icon: PropTypes.elementType.isRequired,
    isEnabled: PropTypes.bool,
    onClick: PropTypes.func.isRequired,
    kbd: PropTypes.node
}