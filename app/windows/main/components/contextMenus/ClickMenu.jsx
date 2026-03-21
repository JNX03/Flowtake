import {
    AdjustmentsHorizontalIcon,
    EyeIcon,
    EyeSlashIcon
} from "@heroicons/react/16/solid"
import {
    useCallback,
    useMemo
} from "react"
import {
    useDispatch,
    useSelector
} from "react-redux"
import {
    selectClickEntities,
    updateClicks
} from "@shared/redux/clickSlice"
import {
    selectIsClickMenuOpen,
    setIsClickMenuOpen
} from "@shared/redux/contextMenuSlice"
import { selectSelectedIds } from "@shared/redux/timelineSlice"
import Divider from "./Divider"
import Item from "./Item"
import Menu from "./Menu"
import SelectAllButton from "./SelectAllButton"

export default function ClickMenu() {

    const dispatch = useDispatch()

    const isOpen = useSelector(selectIsClickMenuOpen)
    const selectedIds = useSelector(selectSelectedIds)
    const entities = useSelector(selectClickEntities)

    const selectedConfigs = useMemo(
        () => selectedIds.map(id => entities[id]).filter(Boolean),
        [selectedIds, entities])

    const close = useCallback(() => dispatch(setIsClickMenuOpen(false)), [dispatch])

    const onEnable = useCallback(() => {
        close()
        dispatch(updateClicks(selectedConfigs.map(({ id }) => ({ id, changes: { isActive: true } }))))
    }, [close, dispatch, selectedConfigs])

    const onDisable = useCallback(() => {
        close()
        dispatch(updateClicks(selectedConfigs.map(({ id }) => ({ id, changes: { isActive: false } }))))
    }, [close, dispatch, selectedConfigs])

    return (
        <Menu isOpen={isOpen} close={close}>
            <Item text="Enable click" icon={EyeIcon}
                isEnabled={selectedConfigs.length > 1 || !selectedConfigs[0]?.isActive} onClick={onEnable} />
            <Item text="Disable click" icon={EyeSlashIcon}
                isEnabled={selectedConfigs.length > 1 || selectedConfigs[0]?.isActive} onClick={onDisable} />
            <Divider />
            <SelectAllButton close={close} />
            <Divider />
            <Item text="Customize" icon={AdjustmentsHorizontalIcon} isEnabled={true} onClick={close} />
        </Menu>
    )
}