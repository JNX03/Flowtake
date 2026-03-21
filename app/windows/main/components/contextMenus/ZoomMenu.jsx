import {
    AdjustmentsHorizontalIcon,
    ArrowLeftIcon,
    ArrowLongLeftIcon,
    ArrowLongRightIcon,
    ArrowRightIcon,
    ArrowsRightLeftIcon,
    ScissorsIcon
} from "@heroicons/react/16/solid"
import {
    useCallback,
    useMemo
} from "react"
import { useHotkeys } from "react-hotkeys-hook"
import {
    useDispatch,
    useSelector
} from "react-redux"
import {
    canMaximizeZoom,
    canMergeZoomLeft,
    canMergeZoomRight,
    canSplitZoom,
    maximizeZoom,
    mergeZoomLeft,
    mergeZoomRight,
    removeZoomConfigs,
    splitZoom
} from "@shared/helpers"
import {
    selectAllCameraZooms,
    selectTargetScale as selectCameraZoomTargetScale
} from "@shared/redux/cameraZoomSlice"
import {
    selectIsZoomMenuOpen,
    setIsZoomMenuOpen
} from "@shared/redux/contextMenuSlice"
import {
    selectAreHotkeysEnabled,
    selectDuration,
    selectIsPlaying
} from "@shared/redux/editorSlice"
import { selectAllPans } from "@shared/redux/panSlice"
import {
    selectSelectedIds,
    selectTime
} from "@shared/redux/timelineSlice"
import {
    selectAllZooms,
    selectIntro,
    selectOutro,
    selectZoomEntities,
    selectBlurStrength as selectZoomBlurStrength,
    selectTargetScale as selectZoomTargetScale
} from "@shared/redux/zoomSlice"
import DeleteButton from "./DeleteButton"
import Divider from "./Divider"
import Item from "./Item"
import Menu from "./Menu"
import SelectAllButton from "./SelectAllButton"

export default function ZoomMenu() {

    const dispatch = useDispatch()

    const isOpen = useSelector(selectIsZoomMenuOpen)
    const zooms = useSelector(selectAllZooms)
    const pans = useSelector(selectAllPans)
    const cameraZooms = useSelector(selectAllCameraZooms)
    const selectedIds = useSelector(selectSelectedIds)
    const areHotkeysEnabled = useSelector(selectAreHotkeysEnabled)
    const isPlaying = useSelector(selectIsPlaying)
    const zoomEntities = useSelector(selectZoomEntities)
    const time = useSelector(selectTime)
    const duration = useSelector(selectDuration)
    const cameraZoomTargetScale = useSelector(selectCameraZoomTargetScale)
    const zoomTargetScale = useSelector(selectZoomTargetScale)
    const intro = useSelector(selectIntro)
    const outro = useSelector(selectOutro)
    const zoomBlurStrength = useSelector(selectZoomBlurStrength)

    const selectedZooms = useMemo(
        () => selectedIds.map(id => zoomEntities[id]).filter(Boolean),
        [selectedIds, zoomEntities])

    const selectedPans = useMemo(
        () => selectedZooms
            .map(zoom => pans.find(({ start, end }) => start === zoom.start && end === zoom.end))
            .filter(Boolean),
        [selectedZooms, pans])

    const selectedCameraZooms = useMemo(
        () => selectedZooms
            .map(zoom => cameraZooms.find(({ start, end }) => start === zoom.start && end === zoom.end))
            .filter(Boolean),
        [selectedZooms, cameraZooms])

    const isSplittingEnabled = useMemo(
        () => selectedZooms.length === 1
            && selectedPans.length === 1
            && selectedCameraZooms.length === 1
            && canSplitZoom(selectedZooms[0], selectedPans[0], selectedCameraZooms[0], time),
        [selectedZooms, selectedPans, selectedCameraZooms, time]
    )

    const isMergeRightEnabled = useMemo(
        () => selectedZooms.length === 1
            && selectedPans.length === 1
            && selectedCameraZooms.length === 1
            && canMergeZoomRight(
                selectedZooms[0], zooms,
                selectedPans[0], pans,
                selectedCameraZooms[0], cameraZooms
            ),
        [selectedZooms, selectedPans, selectedCameraZooms, zooms, pans, cameraZooms]
    )

    const isMergeLeftEnabled = useMemo(
        () => selectedZooms.length === 1
            && selectedPans.length === 1
            && selectedCameraZooms.length === 1
            && canMergeZoomLeft(
                selectedZooms[0], zooms,
                selectedPans[0], pans,
                selectedCameraZooms[0], cameraZooms
            ),
        [selectedZooms, selectedPans, selectedCameraZooms, zooms, pans, cameraZooms]
    )

    const isMaximizeEnabled = useMemo(
        () => selectedZooms.length === 1
            && selectedPans.length === 1
            && selectedCameraZooms.length === 1
            && canMaximizeZoom(
                duration,
                selectedZooms[0], zooms,
                selectedPans[0], pans,
                selectedCameraZooms[0], cameraZooms
            ),
        [selectedZooms, selectedPans, selectedCameraZooms, zooms, pans, cameraZooms, duration]
    )

    const isDeleteEnabled = useMemo(
        () => selectedZooms.length >= 1
            && selectedPans.length === selectedZooms.length
            && selectedCameraZooms.length === selectedZooms.length,
        [selectedZooms, selectedPans, selectedCameraZooms]
    )

    const close = useCallback(() => dispatch(setIsZoomMenuOpen(false)), [dispatch])

    const split = useCallback(() => {
        const actions = splitZoom(
            selectedZooms[0],
            selectedPans[0],
            selectedCameraZooms[0],
            time,
            cameraZoomTargetScale,
            intro,
            outro,
            zoomTargetScale,
            zoomBlurStrength
        )
        actions.forEach(action => dispatch(action))
    }, [dispatch, selectedZooms, selectedPans, selectedCameraZooms, time, cameraZoomTargetScale, intro, outro, zoomTargetScale, zoomBlurStrength])

    const mergeLeft = useCallback(() => {
        const actions = mergeZoomLeft(
            selectedZooms[0],
            zooms,
            selectedPans[0],
            pans,
            selectedCameraZooms[0],
            cameraZooms
        )
        actions.forEach(action => dispatch(action))
    }, [dispatch, selectedZooms, zooms, selectedPans, pans, selectedCameraZooms, cameraZooms])

    const mergeRight = useCallback(() => {
        const actions = mergeZoomRight(
            selectedZooms[0], zooms,
            selectedPans[0], pans,
            selectedCameraZooms[0], cameraZooms
        )
        actions.forEach(action => dispatch(action))
    }, [dispatch, selectedZooms, zooms, selectedPans, pans, selectedCameraZooms, cameraZooms])

    const maximize = useCallback(() => {
        const actions = maximizeZoom(
            duration,
            selectedZooms[0],
            zooms,
            selectedPans[0],
            pans,
            selectedCameraZooms[0],
            cameraZooms
        )
        actions.forEach(action => dispatch(action))
    }, [dispatch, selectedZooms, zooms, selectedPans, pans, selectedCameraZooms, cameraZooms, duration])

    const onDelete = useCallback(() => {
        const actions = removeZoomConfigs(selectedZooms, selectedPans, selectedCameraZooms)
        actions.forEach(action => dispatch(action))
    }, [dispatch, selectedZooms, selectedPans, selectedCameraZooms])

    useHotkeys('s',
        () => split(),
        { enabled: areHotkeysEnabled && isSplittingEnabled && !isPlaying },
        [isSplittingEnabled, areHotkeysEnabled, isPlaying])

    useHotkeys('m+left',
        () => mergeLeft(),
        { enabled: areHotkeysEnabled && isMergeLeftEnabled && !isPlaying },
        [isMergeLeftEnabled, areHotkeysEnabled, isPlaying])

    useHotkeys('m+right',
        () => mergeRight(),
        { enabled: areHotkeysEnabled && isMergeRightEnabled && !isPlaying },
        [isMergeRightEnabled, areHotkeysEnabled, isPlaying])

    useHotkeys('f',
        () => maximize(),
        { enabled: areHotkeysEnabled && isMaximizeEnabled && !isPlaying },
        [isMaximizeEnabled, areHotkeysEnabled, isPlaying])

    useHotkeys('delete', () => onDelete(),
        { enabled: areHotkeysEnabled && isDeleteEnabled && !isPlaying },
        [isDeleteEnabled, areHotkeysEnabled, isPlaying])

    return (
        <Menu isOpen={isOpen} close={close}>
            <Item text="Split at time cursor" icon={ScissorsIcon} isEnabled={isSplittingEnabled}
                onClick={split} kbd={<kbd className="kbd kbd-sm">s</kbd>} />
            <Item text="Merge left" icon={ArrowLeftIcon} isEnabled={isMergeLeftEnabled}
                onClick={mergeLeft}
                kbd={<>
                    <kbd className="kbd kbd-sm">m</kbd>
                    <kbd className="kbd kbd-sm"><ArrowLongLeftIcon className="size-4" /></kbd>
                </>}
            />
            <Item text="Merge right" icon={ArrowRightIcon} isEnabled={isMergeRightEnabled}
                onClick={mergeRight}
                kbd={<>
                    <kbd className="kbd kbd-sm">m</kbd>
                    <kbd className="kbd kbd-sm"><ArrowLongRightIcon className="size-4" /></kbd>
                </>}
            />
            <Item text="Maximize" icon={ArrowsRightLeftIcon} isEnabled={isMaximizeEnabled}
                onClick={maximize} kbd={<kbd className="kbd kbd-sm">f</kbd>} />
            <Divider />
            <SelectAllButton close={close} />
            <Divider />
            <DeleteButton onDelete={onDelete} />
            <Divider />
            <Item text="Customize" icon={AdjustmentsHorizontalIcon} isEnabled={true} onClick={close} />
        </Menu >
    )
}