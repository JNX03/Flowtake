import PropTypes from 'prop-types'
import icon from "../src/assets/logo.svg"

export default function TitleBar({ children, overlayButtons, title, subtitle }) {

    const padding = () => {
        switch (overlayButtons) {
            case 1: return "pr-12"
            case 2: return "pr-24"
            case 3: return "pr-36"
            default: return "pr-0"
        }
    }
    
    return (
        <>
            <div className={`fixed w-full top-0 z-10 bg-base-300 flex ${padding()} gap-2`}>
                <div className="flex-1 min-w-0 p-1 pr-0 flex select-none" style={{ WebkitAppRegion: "drag" }}>
                    <div className="avatar mr-2">
                        <div className="w-5 h-5">
                            <img src={icon} />
                        </div>
                    </div>
                    <h1 className="text-ellipsis text-nowrap overflow-hidden flex-1 flex items-center">
                        <span className="font-brand font-semibold text-sm text-ellipsis text-nowrap overflow-hidden flex-none">
                            {title || "Flowtake"}
                        </span>
                        {subtitle && (
                            <span className="font-brand font-normal text-sm ml-3 flex-1 min-w-0 text-ellipsis text-nowrap overflow-hidden">
                                {subtitle}
                            </span>
                        )}
                    </h1>
                </div>
                {children}
            </div >
        </>
    )
}

TitleBar.propTypes = {
    children: PropTypes.node,
    overlayButtons: PropTypes.oneOf([1, 2, 3]),
    title: PropTypes.string,
    subtitle: PropTypes.string
}