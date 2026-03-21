import {
    AdjustmentsHorizontalIcon,
    ArrowsPointingOutIcon,
    ArrowsRightLeftIcon,
    ArrowsUpDownIcon
} from "@heroicons/react/24/outline"
import {
    useCallback,
    useMemo
} from "react"
import {
    useDispatch,
    useSelector
} from "react-redux"
import Button from "../../../../components/Button"
import {
    formatFixed,
    formatMs,
    formatX,
    TOAST_SUCCESS
} from "@shared/helpers"
import {
    getGroup,
    withGroup
} from "@shared/redux/actionEnhancers"
import { addToast } from "@shared/redux/appSlice"
import {
    selectAllCameraZooms,
    selectTargetScale,
    setTargetScale as setCameraTargetScale,
    updateCameraZooms
} from "@shared/redux/cameraZoomSlice"
import {
    selectAllPans,
    updatePans
} from "@shared/redux/panSlice"
import { selectHasCameraVideo } from "@shared/redux/projectSlice"
import {
    selectSelectedIds
} from "@shared/redux/timelineSlice"
import {
    selectBlurStrength,
    selectTargetScale as selectCameraZoomTargetScale,
    selectIntro,
    selectOutro,
    selectZoomEntities,
    setBlurStrength,
    setIntro,
    setOutro,
    setTargetScale,
    updateZooms
} from "@shared/redux/zoomSlice"
import Card from "./Card"
import CoordPicker from "./CoordPicker"
import Fieldset from "./Fieldset"
import Slider from "./Slider"
import Toggle from "./Toggle"

export default function ZoomSection() {

    const selectedIds = useSelector(selectSelectedIds)
    const hasCameraVideo = useSelector(selectHasCameraVideo)
    const zoomEntities = useSelector(selectZoomEntities)
    const pans = useSelector(selectAllPans)
    const cameraZooms = useSelector(selectAllCameraZooms)
    const defaultTargetScale = useSelector(selectCameraZoomTargetScale)
    const defaultBlurStrength = useSelector(selectBlurStrength)
    const defaultCameraTargetScale = useSelector(selectTargetScale)
    const defaultIntro = useSelector(selectIntro)
    const defaultOutro = useSelector(selectOutro)

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

    const isCheckedIsManual = useMemo(() => {
        if (selectedPans.length === 0) return false
        return selectedPans.every(({ isManual }) => isManual === selectedPans[0].isManual)
            ? selectedPans[0].isManual
            : false
    }, [selectedPans])

    const isIndeterminateIsManual = useMemo(
        () => !selectedPans.every(({ isManual }) => isManual === selectedPans[0]?.isManual),
        [selectedPans])

    const isIndeterminateTargetScale = useMemo(
        () => !selectedZooms.every(({ targetScale }) => targetScale === selectedZooms[0]?.targetScale) &&
            !selectedPans.every(({ targetScale }) => targetScale === selectedPans[0]?.targetScale),
        [selectedZooms, selectedPans])

    const isIndeterminateBlurStrength = useMemo(
        () => !selectedZooms.every(({ blurStrength }) => blurStrength === selectedZooms[0]?.blurStrength),
        [selectedZooms])

    const isIndeterminateCameraTargetScale = useMemo(
        () => !selectedCameraZooms.every(({ targetScale }) => targetScale === selectedCameraZooms[0]?.targetScale),
        [selectedCameraZooms])

    const isIndeterminateIntro = useMemo(
        () => !selectedZooms.every(({ intro }) => intro === selectedZooms[0]?.intro) &&
            !selectedPans.every(({ intro }) => intro === selectedPans[0]?.intro) &&
            !selectedCameraZooms.every(({ intro }) => intro === selectedCameraZooms[0]?.intro),
        [selectedZooms, selectedPans, selectedCameraZooms])

    const isIndeterminateOutro = useMemo(
        () => !selectedZooms.every(({ outro }) => outro === selectedZooms[0]?.outro) &&
            !selectedPans.every(({ outro }) => outro === selectedPans[0]?.outro) &&
            !selectedCameraZooms.every(({ outro }) => outro === selectedCameraZooms[0]?.outro),
        [selectedZooms, selectedPans, selectedCameraZooms])

    const manualPanFocus = useMemo(
        () => selectedPans.every(({ isManual }) => isManual === selectedPans[0].isManual) && selectedPans[0]?.focus
            ? selectedPans[0]?.focus
            : null,
        [selectedPans])

    const isDisabled = useMemo(
        () => selectedZooms.length === 0 || selectedPans.length === 0 || selectedCameraZooms.length === 0,
        [selectedZooms, selectedPans, selectedCameraZooms])

    const dispatch = useDispatch()

    const onChangeTargetScale = useCallback((targetScale, group) => {
        dispatch(withGroup(updateZooms(selectedZooms.map(({ id }) => ({ id, changes: { targetScale } }))), group))
        dispatch(withGroup(updatePans(selectedZooms.map(({ id }) => ({ id, changes: { targetScale } }))), group))
    }, [dispatch, selectedZooms])

    const onChangeCameraTargetScale = useCallback((targetScale, group) =>
        dispatch(withGroup(updateCameraZooms(selectedCameraZooms.map(({ id }) => ({ id, changes: { targetScale } }))), group)),
        [dispatch, selectedCameraZooms])

    const onChangeBlurStrength = useCallback((blurStrength, group) =>
        dispatch(withGroup(updateZooms(selectedZooms.map(({ id }) => ({ id, changes: { blurStrength } }))), group)),
        [dispatch, selectedZooms])

    const onChangeIsAutoZoom = useCallback(event =>
        dispatch(updatePans(selectedPans.map(({ id }) => ({ id, changes: { isManual: !event.target.checked } })))),
        [dispatch, selectedPans])

    const onChangeFocus = useCallback(
        (focus, group) => dispatch(withGroup(updatePans(selectedPans.map(({ id }) => ({ id, changes: { focus } }))), group)),
        [dispatch, selectedPans])

    const onClickCenterHorizontally = useCallback(
        () => dispatch(updatePans(selectedPans.map(({ id, focus }) => ({ id, changes: { focus: { ...focus, x: .5 } } })))),
        [dispatch, selectedPans])

    const onClickCenterVertically = useCallback(
        () => dispatch(updatePans(selectedPans.map(({ id, focus }) => ({ id, changes: { focus: { ...focus, y: .5 } } })))),
        [dispatch, selectedPans])

    const onChangeIntro = useCallback((intro, group) => {
        dispatch(withGroup(updateZooms(selectedZooms.map(({ id }) => ({ id, changes: { intro } }))), group))
        dispatch(withGroup(updatePans(selectedPans.map(({ id }) => ({ id, changes: { intro } }))), group))
        dispatch(withGroup(updateCameraZooms(selectedCameraZooms.map(({ id }) => ({ id, changes: { intro } }))), group))
    }, [dispatch, selectedZooms, selectedPans, selectedCameraZooms])

    const onChangeOutro = useCallback((outro, group) => {
        dispatch(withGroup(updateZooms(selectedZooms.map(({ id }) => ({ id, changes: { outro } }))), group))
        dispatch(withGroup(updatePans(selectedPans.map(({ id }) => ({ id, changes: { outro } }))), group))
        dispatch(withGroup(updateCameraZooms(selectedCameraZooms.map(({ id }) => ({ id, changes: { outro } }))), group))
    }, [dispatch, selectedZooms, selectedPans, selectedCameraZooms])

    const setAsDefault = useCallback(() => {
        const group = getGroup("set-default")
        if (!isIndeterminateIntro) dispatch(withGroup(setIntro(selectedZooms[0].intro), group))
        if (!isIndeterminateOutro) dispatch(withGroup(setOutro(selectedZooms[0].outro), group))
        if (!isIndeterminateTargetScale) dispatch(withGroup(setTargetScale(selectedZooms[0].targetScale), group))
        if (!isIndeterminateBlurStrength) dispatch(withGroup(setBlurStrength(selectedZooms[0].blurStrength), group))
        if (!isIndeterminateCameraTargetScale) dispatch(withGroup(setCameraTargetScale(selectedCameraZooms[0].targetScale), group))
        dispatch(addToast({ type: TOAST_SUCCESS, text: "Defaults updated" }))
    }, [dispatch, isIndeterminateIntro, isIndeterminateOutro, isIndeterminateTargetScale, isIndeterminateBlurStrength, isIndeterminateCameraTargetScale, selectedZooms, selectedCameraZooms])

    return <Card icon={<ArrowsPointingOutIcon className="w-6 h-6" />} title="Zoom" showClose={true}>
        <Fieldset legend="Zoom Level">
            <Slider min={1} max={6} value={selectedZooms[0]?.targetScale ?? defaultTargetScale}
                isIndeterminate={isIndeterminateTargetScale} onChange={onChangeTargetScale} label="Zoom"
                format={formatX} disabled={isDisabled} />
        </Fieldset>

        <Fieldset legend="Zooming Mode">
            <Toggle leftLabel="Manual Zoom" rightLabel="Follow Cursor" value={!isCheckedIsManual}
                isIndeterminate={isIndeterminateIsManual} onChange={onChangeIsAutoZoom} disabled={isDisabled} />

            {isCheckedIsManual && manualPanFocus && <>
                <CoordPicker coords={manualPanFocus} onChange={onChangeFocus} disabled={isDisabled} />
                <div className="w-full flex justify-center">
                    <div className="join">
                        <Button icon={ArrowsRightLeftIcon} className="join-item btn-square"
                            onClick={onClickCenterHorizontally} tooltip="Center horizontally" />
                        <Button icon={ArrowsUpDownIcon} className="join-item btn-square"
                            onClick={onClickCenterVertically} tooltip="Center vertically" />
                    </div>
                </div>
            </>}
        </Fieldset>

        <Fieldset legend="Blur Effect" description="Adding Blur Effect makes transitions look more dynamic. Set to 0 to disable.">
            <Slider max={3} value={selectedZooms[0]?.blurStrength ?? defaultBlurStrength}
                isIndeterminate={isIndeterminateBlurStrength} onChange={onChangeBlurStrength}
                label={"Effect Strength"} format={formatFixed} disabled={isDisabled} />
        </Fieldset>

        {hasCameraVideo && <>
            <Fieldset legend="Camera Zoom Level" description="Make the camera video smaller while zoomed in. Set to 1 to disable.">
                <Slider min={.1} value={selectedCameraZooms[0]?.targetScale ?? defaultCameraTargetScale}
                    isIndeterminate={isIndeterminateCameraTargetScale} onChange={onChangeCameraTargetScale}
                    label={"Camera Zoom"} format={formatX} disabled={isDisabled} />
            </Fieldset>
        </>}

        <Fieldset legend="Intro and Outro" description="Change the zoom timing by adjusting the Intro or Outro Duration. To start the video zoomed in, make sure there is a Zoom Animation at the beginning of the video and set its intro to 0.">
            <Slider max={2000} value={selectedPans[0]?.intro ?? defaultIntro} isIndeterminate={isIndeterminateIntro}
                onChange={onChangeIntro} label={"Intro Duration"} format={formatMs} disabled={isDisabled} />
            <Slider max={2000} value={selectedPans[0]?.outro ?? defaultOutro} isIndeterminate={isIndeterminateOutro}
                onChange={onChangeOutro} label={"Outro Duration"} format={formatMs} disabled={isDisabled} />
        </Fieldset>

        <div className="mt-4 flex justify-center">
            <Button icon={AdjustmentsHorizontalIcon} onClick={setAsDefault} disabled={isDisabled}>
                Set as default
            </Button>
        </div>
    </Card>
}