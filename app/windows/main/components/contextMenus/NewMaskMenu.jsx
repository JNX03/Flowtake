import { PlusIcon } from "@heroicons/react/16/solid"
import { useQuery } from "@tanstack/react-query"
import {
    useCallback,
    useMemo
} from "react"
import {
    useDispatch,
    useSelector
} from "react-redux"
import { PROJECT_SCREEN_VIDEO } from "@shared/constants"
import { createMask } from "@shared/helpers"
import {
    selectIsNewMaskMenuOpen,
    selectSelectedMaskRow,
    selectTime,
    setIsNewMaskMenuOpen,
    setSelectedMaskRow
} from "@shared/redux/contextMenuSlice"
import { selectDuration } from "@shared/redux/editorSlice"
import {
    selectAllMasks,
    selectAlpha,
    selectBlurStrength,
    selectBorderRadius,
    selectFill
} from "@shared/redux/maskSlice"
import {
    selectBottomTrim,
    selectId,
    selectLeftTrim,
    selectRightTrim,
    selectTopTrim
} from "@shared/redux/projectSlice"
import RendererInputReader from "@shared/RendererInputReader"
import Item from "./Item"
import Menu from "./Menu"

export default function NewMaskMenu() {

    const dispatch = useDispatch()

    const isOpen = useSelector(selectIsNewMaskMenuOpen)
    const time = useSelector(selectTime)
    const duration = useSelector(selectDuration)
    const selectedMaskRow = useSelector(selectSelectedMaskRow)
    const leftTrim = useSelector(selectLeftTrim)
    const rightTrim = useSelector(selectRightTrim)
    const topTrim = useSelector(selectTopTrim)
    const bottomTrim = useSelector(selectBottomTrim)
    const masks = useSelector(selectAllMasks)
    const blurStrength = useSelector(selectBlurStrength)
    const alpha = useSelector(selectAlpha)
    const borderRadius = useSelector(selectBorderRadius)
    const fill = useSelector(selectFill)
    const id = useSelector(selectId)

    const { isPending, isError, data: videoDims } = useQuery({
        queryKey: ['videoDims', id],
        queryFn: () => RendererInputReader.getDimensions(PROJECT_SCREEN_VIDEO, { projectId: id }),
        staleTime: Infinity,
    })

    const isEnabled = useMemo(() =>
        isOpen && duration && time !== null && time >= 0 && time <= duration && !isPending && !isError,
        [isOpen, duration, time, isPending, isError]
    )

    const onNew = useCallback(async () => {
        dispatch(setIsNewMaskMenuOpen(false))
        dispatch(createMask(time, selectedMaskRow, leftTrim, rightTrim, topTrim, bottomTrim, videoDims, duration, masks,
            blurStrength, alpha, borderRadius, fill))
        dispatch(setSelectedMaskRow(null))
    }, [dispatch, time, selectedMaskRow, leftTrim, rightTrim, topTrim, bottomTrim, videoDims, duration, masks,
        blurStrength, alpha, borderRadius, fill])

    const close = useCallback(async () => {
        dispatch(setIsNewMaskMenuOpen(false))
    }, [dispatch])

    return (
        <Menu isOpen={isOpen && selectedMaskRow !== null} close={close}>
            <Item text="New Mask" icon={PlusIcon} isEnabled={isEnabled} onClick={onNew} />
        </Menu>
    )
}