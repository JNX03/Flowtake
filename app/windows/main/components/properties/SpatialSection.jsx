import {
    AdjustmentsHorizontalIcon,
    CubeIcon,
    EyeIcon
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
    EASING_OPTIONS,
    formatFixed,
    formatMs
} from "@shared/helpers"
import {
    getGroup,
    withGroup
} from "@shared/redux/actionEnhancers"
import { addToast } from "@shared/redux/appSlice"
import {
    selectSelectedIds
} from "@shared/redux/timelineSlice"
import {
    selectSpatialCameraDistance,
    selectSpatialEntities,
    selectSpatialEyeContactEnabled,
    selectSpatialIntro,
    selectSpatialOutro,
    selectSpatialPerspective,
    selectSpatialRotateX,
    selectSpatialRotateY,
    selectSpatialRotateZ,
    setCameraDistance,
    setEyeContactEnabled,
    setIntro,
    setOutro,
    setPerspective,
    setRotateX,
    setRotateY,
    setRotateZ,
    updateSpatials
} from "@shared/redux/spatialSlice"
import { TOAST_SUCCESS } from "@shared/helpers"
import Card from "./Card"
import Fieldset from "./Fieldset"
import Slider from "./Slider"
import Toggle from "./Toggle"

export default function SpatialSection() {

    const selectedIds = useSelector(selectSelectedIds)
    const spatialEntities = useSelector(selectSpatialEntities)
    const defaultRotateX = useSelector(selectSpatialRotateX)
    const defaultRotateY = useSelector(selectSpatialRotateY)
    const defaultRotateZ = useSelector(selectSpatialRotateZ)
    const defaultPerspective = useSelector(selectSpatialPerspective)
    const defaultCameraDistance = useSelector(selectSpatialCameraDistance)
    const defaultEyeContactEnabled = useSelector(selectSpatialEyeContactEnabled)
    const defaultIntro = useSelector(selectSpatialIntro)
    const defaultOutro = useSelector(selectSpatialOutro)

    const selectedSpatials = useMemo(
        () => selectedIds.map(id => spatialEntities[id]).filter(Boolean),
        [selectedIds, spatialEntities])

    const isDisabled = selectedSpatials.length === 0

    const dispatch = useDispatch()

    const onChangeRotateX = useCallback((rotateX, group) =>
        dispatch(withGroup(updateSpatials(selectedSpatials.map(({ id }) => ({ id, changes: { rotateX } }))), group)),
        [dispatch, selectedSpatials])

    const onChangeRotateY = useCallback((rotateY, group) =>
        dispatch(withGroup(updateSpatials(selectedSpatials.map(({ id }) => ({ id, changes: { rotateY } }))), group)),
        [dispatch, selectedSpatials])

    const onChangeRotateZ = useCallback((rotateZ, group) =>
        dispatch(withGroup(updateSpatials(selectedSpatials.map(({ id }) => ({ id, changes: { rotateZ } }))), group)),
        [dispatch, selectedSpatials])

    const onChangePerspective = useCallback((perspective, group) =>
        dispatch(withGroup(updateSpatials(selectedSpatials.map(({ id }) => ({ id, changes: { perspective } }))), group)),
        [dispatch, selectedSpatials])

    const onChangeCameraDistance = useCallback((cameraDistance, group) =>
        dispatch(withGroup(updateSpatials(selectedSpatials.map(({ id }) => ({ id, changes: { cameraDistance } }))), group)),
        [dispatch, selectedSpatials])

    const onChangeEyeContact = useCallback(event =>
        dispatch(updateSpatials(selectedSpatials.map(({ id }) => ({ id, changes: { eyeContactEnabled: event.target.checked } })))),
        [dispatch, selectedSpatials])

    const onChangeIntro = useCallback((intro, group) =>
        dispatch(withGroup(updateSpatials(selectedSpatials.map(({ id }) => ({ id, changes: { intro } }))), group)),
        [dispatch, selectedSpatials])

    const onChangeOutro = useCallback((outro, group) =>
        dispatch(withGroup(updateSpatials(selectedSpatials.map(({ id }) => ({ id, changes: { outro } }))), group)),
        [dispatch, selectedSpatials])

    const onChangeEasing = useCallback(easing =>
        dispatch(updateSpatials(selectedSpatials.map(({ id }) => ({ id, changes: { easing } })))),
        [dispatch, selectedSpatials])

    const setAsDefault = useCallback(() => {
        const group = getGroup("set-default")
        const s = selectedSpatials[0]
        if (s) {
            dispatch(withGroup(setRotateX(s.rotateX), group))
            dispatch(withGroup(setRotateY(s.rotateY), group))
            dispatch(withGroup(setRotateZ(s.rotateZ), group))
            dispatch(withGroup(setPerspective(s.perspective), group))
            dispatch(withGroup(setCameraDistance(s.cameraDistance), group))
            dispatch(withGroup(setEyeContactEnabled(s.eyeContactEnabled), group))
            dispatch(withGroup(setIntro(s.intro), group))
            dispatch(withGroup(setOutro(s.outro), group))
        }
        dispatch(addToast({ type: TOAST_SUCCESS, text: "Defaults updated" }))
    }, [dispatch, selectedSpatials])

    const applyPreset = useCallback(preset => {
        const group = getGroup("spatial-preset")
        dispatch(withGroup(updateSpatials(selectedSpatials.map(({ id }) => ({ id, changes: preset }))), group))
    }, [dispatch, selectedSpatials])

    const SPATIAL_PRESETS = [
        { name: "Subtle Tilt", rotateX: 10, rotateY: 5, rotateZ: 0, perspective: 800, cameraDistance: 1.5 },
        { name: "Dramatic", rotateX: 25, rotateY: 20, rotateZ: 0, perspective: 600, cameraDistance: 1.2 },
        { name: "Dynamic Roll", rotateX: 15, rotateY: 0, rotateZ: 10, perspective: 800, cameraDistance: 1.5 },
        { name: "Cinematic", rotateX: 8, rotateY: 15, rotateZ: 0, perspective: 500, cameraDistance: 2.0 },
    ]

    const formatDeg = v => `${v > 0 ? '+' : ''}${Math.round(v)}°`
    const formatPx = v => `${Math.round(v)}px`

    return <Card icon={<CubeIcon className="w-6 h-6" />} title="Spatial" showClose={true}>
        <Fieldset legend="Spatial Presets">
            <div className="grid grid-cols-4 gap-1">
                {SPATIAL_PRESETS.map(preset => (
                    <button key={preset.name} onClick={() => applyPreset(preset)} disabled={isDisabled}
                        className="px-1.5 py-1.5 rounded text-[10px] font-medium transition-colors bg-base-200 text-base-content/60 hover:text-base-content hover:bg-base-200/80 disabled:opacity-30">
                        {preset.name}
                    </button>
                ))}
            </div>
        </Fieldset>

        <Fieldset legend="3D Rotation">
            <Slider min={-45} max={45} value={selectedSpatials[0]?.rotateX ?? defaultRotateX}
                onChange={onChangeRotateX} label="Tilt X" format={formatDeg} disabled={isDisabled} />
            <Slider min={-45} max={45} value={selectedSpatials[0]?.rotateY ?? defaultRotateY}
                onChange={onChangeRotateY} label="Rotate Y" format={formatDeg} disabled={isDisabled} />
            <Slider min={-15} max={15} value={selectedSpatials[0]?.rotateZ ?? defaultRotateZ}
                onChange={onChangeRotateZ} label="Roll Z" format={formatDeg} disabled={isDisabled} />
        </Fieldset>

        <Fieldset legend="Perspective">
            <Slider min={300} max={2000} value={selectedSpatials[0]?.perspective ?? defaultPerspective}
                onChange={onChangePerspective} label="Depth" format={formatPx} disabled={isDisabled} />
            <Slider min={0.5} max={3} value={selectedSpatials[0]?.cameraDistance ?? defaultCameraDistance}
                onChange={onChangeCameraDistance} label="Distance" format={formatFixed} disabled={isDisabled} />
        </Fieldset>

        <Fieldset legend="Eye Contact" description="Corrects gaze direction in camera video to always face the viewer.">
            <Toggle leftLabel="" rightLabel="Eye Contact Correction" value={selectedSpatials[0]?.eyeContactEnabled ?? defaultEyeContactEnabled}
                onChange={onChangeEyeContact} disabled={isDisabled} icon={EyeIcon} />
        </Fieldset>

        <Fieldset legend="Intro and Outro">
            <Slider max={3000} value={selectedSpatials[0]?.intro ?? defaultIntro}
                onChange={onChangeIntro} label="Intro Duration" format={formatMs} disabled={isDisabled} />
            <Slider max={3000} value={selectedSpatials[0]?.outro ?? defaultOutro}
                onChange={onChangeOutro} label="Outro Duration" format={formatMs} disabled={isDisabled} />

            <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] opacity-50 w-16">Easing</span>
                <select value={selectedSpatials[0]?.easing ?? "expOut"} disabled={isDisabled}
                    onChange={e => onChangeEasing(e.target.value)}
                    className="select select-xs flex-1 bg-base-200 border-0 text-xs rounded">
                    {EASING_OPTIONS.map(opt => (
                        <option key={opt.id} value={opt.id}>{opt.name}</option>
                    ))}
                </select>
            </div>
        </Fieldset>

        <div className="mt-4 flex justify-center">
            <Button icon={AdjustmentsHorizontalIcon} onClick={setAsDefault} disabled={isDisabled}>
                Set as default
            </Button>
        </div>
    </Card>
}
