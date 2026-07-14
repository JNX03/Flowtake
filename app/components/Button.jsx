import PropTypes from "prop-types"

export default function Button({
    icon: Icon,
    isLoading = false,
    onClick,
    disabled = false,
    children,
    size = "md",
    className,
    tooltip,
    ...buttonProps
}) {

    const getButtonSizeClass = size => {
        switch (size) {
            case "xs": return "btn-xs"
            case "sm": return "btn-sm"
            case "md": return ""
            case "lg": return "btn-lg"
            case "xl": return "btn-xl"
            default: return ""
        }
    }

    const getIconSizeClass = size => {
        switch (size) {
            case "xs": return "size-4"
            case "sm": return "size-5"
            case "md": return "size-6"
            case "lg": return "size-7"
            case "xl": return "size-8"
            default: return "size-6"
        }
    }

    const getSpinnerSizeClass = size => {
        switch (size) {
            case "xs": return "loading-xs"
            case "sm": return "loading-sm"
            case "md": return "loading-md"
            case "lg": return "loading-lg"
            case "xl": return "loading-xl"
            default: return "loading-md"
        }
    }

    return (
        <button
            className={`btn ${getButtonSizeClass(size)} ${className || ""} ${tooltip ? "tooltip" : ""}`}
            onClick={onClick}
            disabled={disabled || isLoading}
            {...(tooltip ? { "data-tip": tooltip } : {})}
            {...buttonProps}
        >
            {!isLoading && Icon && <Icon className={getIconSizeClass(size)} />}
            {isLoading && <span className={`loading loading-spinner ${getSpinnerSizeClass(size)}`} />}
            {children}
        </button>
    )
}

Button.propTypes = {
    icon: PropTypes.elementType,
    isLoading: PropTypes.bool,
    onClick: PropTypes.func.isRequired,
    disabled: PropTypes.bool,
    children: PropTypes.node,
    size: PropTypes.oneOf(["xs", "sm", "md", "lg", "xl"]),
    className: PropTypes.string,
    tooltip: PropTypes.string
}
