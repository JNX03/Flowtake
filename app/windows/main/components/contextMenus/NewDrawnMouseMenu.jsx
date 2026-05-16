import { PencilSquareIcon } from "@heroicons/react/16/solid"
import { useCallback } from "react"
import { useDispatch, useSelector } from "react-redux"
import {
    selectIsNewDrawnMouseMenuOpen,
    setIsNewDrawnMouseMenuOpen
} from "@shared/redux/contextMenuSlice"
import { setIsDrawMouseModeActive } from "@shared/redux/pluginSlice"
import Item from "./Item"
import Menu from "./Menu"

export default function NewDrawnMouseMenu() {
    const dispatch = useDispatch()

    const isOpen = useSelector(selectIsNewDrawnMouseMenuOpen)

    const close = useCallback(() => {
        dispatch(setIsNewDrawnMouseMenuOpen(false))
    }, [dispatch])

    const onArmDraw = useCallback(() => {
        dispatch(setIsNewDrawnMouseMenuOpen(false))
        dispatch(setIsDrawMouseModeActive(true))
    }, [dispatch])

    return (
        <Menu isOpen={isOpen} close={close}>
            <Item text="Draw a path on the canvas" icon={PencilSquareIcon} isEnabled={true} onClick={onArmDraw} />
        </Menu>
    )
}
