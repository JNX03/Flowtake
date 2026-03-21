import {
    AdjustmentsHorizontalIcon,
    Bars4Icon
} from "@heroicons/react/24/outline"
import {
    useCallback,
    useMemo
} from "react"
import {
    useDispatch,
    useSelector
} from "react-redux"
import { useThrottledCallback } from "use-debounce"
import Button from "../../../../components/Button"
import {
    formatPercent,
    formatPx,
    TOAST_SUCCESS
} from "@shared/helpers"
import {
    getGroup,
    withGroup
} from "@shared/redux/actionEnhancers"
import { addToast } from "@shared/redux/appSlice"
import {
    selectAlpha,
    selectBlurStrength,
    selectBorderRadius,
    selectFill,
    selectMaskEntities,
    setAlpha,
    setBlurStrength,
    setBorderRadius,
    updateMasks
} from "@shared/redux/maskSlice"
import {
    selectSelectedIds
} from "@shared/redux/timelineSlice"
import Card from "./Card"
import ColorPicker from "./ColorPicker"
import Fieldset from "./Fieldset"
import MaskingModal from "./MaskingModal"
import Slider from "./Slider"

export default function MaskSection() {

    const dispatch = useDispatch()

    const selectedIds = useSelector(selectSelectedIds)
    const entities = useSelector(selectMaskEntities)
    const defaultBlurStrength = useSelector(selectBlurStrength)
    const defaultAlpha = useSelector(selectAlpha)
    const defaultBorderRadius = useSelector(selectBorderRadius)
    const defaultFill = useSelector(selectFill)

    const selectedMasks = useMemo(
        () => selectedIds.map(id => entities[id]).filter(Boolean),
        [entities, selectedIds])

    const isIndeterminateBlurStrength = useMemo(
        () => !selectedMasks.every(({ blurStrength }) => blurStrength === selectedMasks[0]?.blurStrength),
        [selectedMasks]
    )

    const isIndeterminateAlpha = useMemo(
        () => !selectedMasks.every(({ alpha }) => alpha === selectedMasks[0]?.alpha),
        [selectedMasks]
    )

    const isIndeterminateBorderRadius = useMemo(
        () => !selectedMasks.every(({ borderRadius }) => borderRadius === selectedMasks[0]?.borderRadius),
        [selectedMasks]
    )

    const onChangeBlurStrength = useCallback((blurStrength, group) =>
        dispatch(withGroup(updateMasks(selectedMasks.map(({ id }) => ({ id, changes: { blurStrength } }))), group)),
        [dispatch, selectedMasks])

    const onChangeAlpha = useCallback((alpha, group) =>
        dispatch(withGroup(updateMasks(selectedMasks.map(({ id }) => ({ id, changes: { alpha } }))), group)),
        [dispatch, selectedMasks])

    const onChangeBorderRadius = useCallback((borderRadius, group) =>
        dispatch(withGroup(updateMasks(selectedMasks.map(({ id }) => ({ id, changes: { borderRadius } }))), group)),
        [dispatch, selectedMasks])

    const setFill = useThrottledCallback(
        (fill, group) =>
            dispatch(withGroup(updateMasks(selectedMasks.map(({ id }) => ({ id, changes: { fill } }))), group)),
        300,
        { 'trailing': true })

    const setAsDefault = useCallback(() => {
        const group = getGroup("set-default")
        if (!isIndeterminateBlurStrength) dispatch(withGroup(setBlurStrength(selectedMasks[0].blurStrength), group))
        if (!isIndeterminateAlpha) dispatch(withGroup(setAlpha(selectedMasks[0].alpha), group))
        if (!isIndeterminateBorderRadius) dispatch(withGroup(setBorderRadius(selectedMasks[0].borderRadius), group))
        dispatch(addToast({ type: TOAST_SUCCESS, text: "Defaults updated" }))
    }, [dispatch, isIndeterminateBlurStrength, isIndeterminateAlpha, isIndeterminateBorderRadius, selectedMasks])

    return (
        <Card icon={<Bars4Icon className="w-6 h-6" />} title="Mask" showClose={true}>

            <div className="flex flex-col items-center gap-2 mt-4">
                <MaskingModal id={selectedIds[0]} disabled={selectedIds.length !== 1} />
            </div>

            <Fieldset legend="Style">
                <Slider value={selectedMasks[0]?.blurStrength ?? defaultBlurStrength}
                    isIndeterminate={isIndeterminateBlurStrength} onChange={onChangeBlurStrength}
                    label="Blur Effect Strength" format={formatPercent} disabled={selectedMasks.length === 0} />

                <Slider value={selectedMasks[0]?.alpha ?? defaultAlpha} isIndeterminate={isIndeterminateAlpha}
                    onChange={onChangeAlpha} label="Alpha" format={formatPercent}
                    disabled={selectedMasks.length === 0} />

                <Slider max={100} value={selectedMasks[0]?.borderRadius ?? defaultBorderRadius}
                    isIndeterminate={isIndeterminateBorderRadius} onChange={onChangeBorderRadius}
                    label="Border Radius" format={formatPx} disabled={selectedMasks.length === 0} />

                <ColorPicker initialValue={selectedMasks[0]?.fill ?? defaultFill} label="Fill Color"
                    onChange={setFill} disabled={selectedMasks.length === 0} />
            </Fieldset>

            <div className="mt-4 flex justify-center">
                <Button onClick={setAsDefault} icon={AdjustmentsHorizontalIcon} disabled={selectedMasks.length === 0}>
                    Set as default
                </Button>
            </div>
        </Card>
    )
}