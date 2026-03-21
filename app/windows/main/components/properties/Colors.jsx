import { useEffect, useMemo, useState, useCallback } from "react"
import { useDispatch, useSelector } from "react-redux"
import { useThrottledCallback } from "use-debounce"
import PropTypes from "prop-types"
import { selectBackground, setBackground } from "@shared/redux/projectSlice"
import ColorPicker from "./ColorPicker"
import Fieldset from "./Fieldset"

const Colors = ({ disabled = false }) => {
    const dispatch = useDispatch()
    const background = useSelector(selectBackground)
    const BACKGROUND_TYPE_COLOR = "color"

    // Derive initial color from background, but allow local state to override
    const [userColor, setUserColor] = useState(null)

    const color = useMemo(() => {
        // If user has set a color, use that
        if (userColor !== null) return userColor

        // Otherwise, derive from background if it's a color type
        if (background?.type === BACKGROUND_TYPE_COLOR) return background.value

        // Default fallback
        return null
    }, [userColor, background])

    const callback = useThrottledCallback(async (value) => {
        if (disabled) return
        
        await window.electron.ipcRenderer.invoke("update-background", "color", null)
        dispatch(setBackground(value))
    }, 100)

    useEffect(() => {
        if (color) callback({ type: "color", value: color })
    }, [callback, color])

    const handleColorChange = useCallback((newColor) => {
        if (!disabled) {
            setUserColor(newColor)
        }
    }, [disabled])

    return (
        <Fieldset legend="Color">
            <ColorPicker 
                initialValue={color || "#000000"} 
                label="Background Color" 
                onChange={handleColorChange}
                disabled={disabled}
            />
        </Fieldset>
    )
}

Colors.propTypes = {
    disabled: PropTypes.bool
}

export default Colors