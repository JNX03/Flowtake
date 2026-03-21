import { useQuery } from "@tanstack/react-query"
import {
    useCallback,
    useMemo
} from "react"
import { useHotkeys } from "react-hotkeys-hook"
import {
    useDispatch,
    useSelector
} from "react-redux"
import { PROJECT_SCREEN_VIDEO } from "@shared/constants"
import {
    createMask,
    MASKS
} from "@shared/helpers"
import {
    setIsNewMaskMenuOpen,
    setSelectedMaskRow
} from "@shared/redux/contextMenuSlice"
import {
    selectAreHotkeysEnabled,
    selectDuration,
    selectIsPlaying
} from "@shared/redux/editorSlice"
import {
    selectAllMasks,
    selectAlpha,
    selectBlurStrength,
    selectBorderRadius,
    selectFill,
    selectMaskIds,
    selectTotalMasks
} from "@shared/redux/maskSlice"
import {
    selectBottomTrim,
    selectId,
    selectLeftTrim,
    selectRightTrim,
    selectTopTrim
} from "@shared/redux/projectSlice"
import {
    selectSelectedRow,
    setOpenSection,
    setSelectedIds
} from "@shared/redux/timelineSlice"
import RendererInputReader from "@shared/RendererInputReader"
import Mask from "./Mask"
import Row from "./Row"

export default function Masks() {

    const dispatch = useDispatch()

    const allMaskAnimIds = useSelector(selectMaskIds)
    const selectedRow = useSelector(selectSelectedRow)
    const areHotkeysEnabled = useSelector(selectAreHotkeysEnabled)
    const isPlaying = useSelector(selectIsPlaying)
    const masks = useSelector(selectAllMasks)
    const totalMasks = useSelector(selectTotalMasks)
    const leftTrim = useSelector(selectLeftTrim)
    const rightTrim = useSelector(selectRightTrim)
    const topTrim = useSelector(selectTopTrim)
    const bottomTrim = useSelector(selectBottomTrim)
    const duration = useSelector(selectDuration)
    const blurStrength = useSelector(selectBlurStrength)
    const alpha = useSelector(selectAlpha)
    const borderRadius = useSelector(selectBorderRadius)
    const fill = useSelector(selectFill)
    const id = useSelector(selectId)

    const { isPending, isError, data: videoDims } = useQuery({
        queryKey: ['videoDims', id],
        queryFn: () => RendererInputReader.getDimensions(PROJECT_SCREEN_VIDEO, { projectId: id }),
        staleTime: Infinity
    })

    useHotkeys(
        'ctrl+a',
        e => {
            e.preventDefault()
            dispatch(setSelectedIds(allMaskAnimIds))
            dispatch(setOpenSection(MASKS))
        },
        { enabled: areHotkeysEnabled && selectedRow === MASKS && !isPlaying },
        [selectedRow, areHotkeysEnabled, isPlaying])

    const onDoubleClick = useCallback(async (time, row) => {
        if (!isPending && !isError)
            dispatch(createMask(time, row, leftTrim, rightTrim, topTrim, bottomTrim, videoDims, duration, masks,
                blurStrength, alpha, borderRadius, fill))
    }, [isPending, isError, dispatch, leftTrim, rightTrim, topTrim, bottomTrim, videoDims, duration, masks, blurStrength, alpha, borderRadius, fill])

    const onContextMenu = useCallback(row => {
        dispatch(setIsNewMaskMenuOpen(true))
        dispatch(setSelectedMaskRow(row))
    }, [dispatch])

    const masksByRow = useMemo(() => {
        return Object.entries(masks.reduce((groups, mask) => {
            const row = mask.row
            if (!groups[row]) {
                groups[row] = []
            }
            groups[row].push(mask)
            return groups
        }, {}))
            .map(([row, masksForRow]) => [Number(row), masksForRow])
            .sort(([a], [b]) => a - b)
    }, [masks])

    const bg = useMemo(() =>
        `bg-linear-to-t to-transparent ${selectedRow === MASKS ? "from-base-content/15 to-80% hover:to-90%" : `from-transparent hover:from-base-content/15 to-50%`}`,
        [selectedRow]
    )

    return (<div className={`grid grid-cols-1 gap-1 pt-1 max-h-26 overflow-y-auto no-scrollbar ${bg}`}>
        {masksByRow
            .map(([row, masksForRow]) => (
                <Row name={MASKS} key={row} className="h-12" animIds={masksForRow.map(({ id }) => id)} action={Mask}
                    onDoubleClick={time => onDoubleClick(time, row)} onContextMenu={() => onContextMenu(row)} />
            ))}

        <Row name={MASKS} className="h-12" animIds={[]} action={Mask}
            onDoubleClick={time => onDoubleClick(time, Math.max(...masks.map(({ row }) => row + 1), 0))}
            onContextMenu={() => onContextMenu(Math.max(...masks.map(({ row }) => row + 1), 0))} />

        {totalMasks === 0 && <Row name={MASKS} className="h-12" animIds={[]} action={Mask}
            onDoubleClick={time => onDoubleClick(time, Math.max(...masks.map(({ row }) => row + 1), 1))}
            onContextMenu={() => onContextMenu(Math.max(...masks.map(({ row }) => row + 1), 1))} />}
    </div>)
}