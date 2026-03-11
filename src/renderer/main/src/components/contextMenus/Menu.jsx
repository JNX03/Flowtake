import PropTypes from 'prop-types'
import {
    useEffect,
    useMemo,
    useRef
} from "react"
import {
    useSelector
} from "react-redux"
import { useResizeDetector } from "react-resize-detector"
import {
    selectPosition
} from "../../../../src/redux/contextMenuSlice"

export default function Menu({ isOpen, children, close }) {

    const position = useSelector(selectPosition)

    const menu = useRef(null)

    const { width, height } = useResizeDetector({ targetRef: menu })

    const left = useMemo(() => {
        if (!position || !width) return null
        return position.x + width > window.innerWidth ? `${position.x - width}px` : `${position.x}px`
    }, [position, width])

    const top = useMemo(() => {
        if (!position || !height) return null
        return position.y + height > window.innerHeight ? `${position.y - height}px` : `${position.y}px`
    }, [position, height])

    const transformOriginX = useMemo(() => {
        if (!position || !width) return null
        return position.x + width > window.innerWidth ? 'right' : 'left'
    }, [position, width])

    const transformOriginY = useMemo(() => {
        if (!position || !height) return null
        return position.y + height > window.innerHeight ? 'bottom' : 'top'
    }, [position, height])

    // Effect to manage the click outside listener based on isOpen state
    useEffect(() => {
        if (isOpen && position) {
            const handleClickOutside = (event) => {
                if (!menu.current) return
                const { left, right, top, bottom } = menu.current.getBoundingClientRect()
                const { clientX, clientY } = event
                if (clientX < left || clientX > right || clientY < top || clientY > bottom)
                    close()
            }

            window.addEventListener("click", handleClickOutside)
            return () => window.removeEventListener("click", handleClickOutside)
        }
    }, [isOpen, position, close])

    return (<>
        {position && <ul
            ref={menu}
            className={
                "menu menu-sm border-base-300/10 border-2 bg-base-300/70 backdrop-blur-md rounded-lg w-64 " +
                "fixed shadow-lg z-40 transition-transform box-border" +
                `${left === null || top === null || !isOpen ? "invisible scale-0" : "scale-100"}`
            }
            style={{
                left: left === null ? 0 : left,
                top: top === null ? 0 : top,
                transformOrigin: `${transformOriginX} ${transformOriginY}`
            }} >
            {children}
        </ul>}
    </>)
}

Menu.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    children: PropTypes.node,
    close: PropTypes.func.isRequired
}