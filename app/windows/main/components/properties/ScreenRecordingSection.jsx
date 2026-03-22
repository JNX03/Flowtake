import { ComputerDesktopIcon } from "@heroicons/react/24/outline"
import { useCallback } from "react"
import {
    useDispatch,
    useSelector
} from "react-redux"
import {
    formatPercent,
    formatPx
} from "@shared/helpers"
import {
    getGroup,
    withGroup
} from "@shared/redux/actionEnhancers"
import {
    selectBorderRadius,
    selectPadding,
    selectShadowAlpha,
    setBorderRadius,
    setPadding,
    setShadowAlpha
} from "@shared/redux/projectSlice"
import Card from "./Card"
import CroppingModal from "./CroppingModal"
import Fieldset from "./Fieldset"
import Slider from "./Slider"

export default function ScreenRecordingSection() {

    const dispatch = useDispatch()

    const padding = useSelector(selectPadding)
    const borderRadius = useSelector(selectBorderRadius)
    const shadowAlpha = useSelector(selectShadowAlpha)

    const onChangePadding = useCallback((value, group) =>
        dispatch(withGroup(setPadding(value), group)),
        [dispatch])

    const onChangeBorderRadius = useCallback((value, group) =>
        dispatch(withGroup(setBorderRadius(value), group)),
        [dispatch])

    const onChangeShadowAlpha = useCallback((value, group) =>
        dispatch(withGroup(setShadowAlpha(value), group)),
        [dispatch])

    const formatPaddingValue = useCallback(value =>
        `${Math.round((1 - value) * 100)}%`,
        [])

    const PADDING_PRESETS = [
        { name: "Full Screen", padding: 1.0, borderRadius: 0, shadowAlpha: 0 },
        { name: "Tight", padding: 0.95, borderRadius: 8, shadowAlpha: 0.3 },
        { name: "Balanced", padding: 0.88, borderRadius: 12, shadowAlpha: 0.5 },
        { name: "Breathe", padding: 0.80, borderRadius: 16, shadowAlpha: 0.5 },
        { name: "Cinematic", padding: 0.70, borderRadius: 20, shadowAlpha: 0.7 },
        { name: "Presentation", padding: 0.60, borderRadius: 24, shadowAlpha: 0.6 },
    ]

    const applyPreset = useCallback((preset) => {
        const group = getGroup("padding-preset")
        dispatch(withGroup(setPadding(preset.padding), group))
        dispatch(withGroup(setBorderRadius(preset.borderRadius), group))
        dispatch(withGroup(setShadowAlpha(preset.shadowAlpha), group))
    }, [dispatch])

    return (<Card icon={<ComputerDesktopIcon className="w-6 h-6" />} title="Screen Recording">
        <Fieldset legend="Quick Presets">
            <div className="grid grid-cols-3 gap-1">
                {PADDING_PRESETS.map(preset => (
                    <button key={preset.name} onClick={() => applyPreset(preset)}
                        className="px-1.5 py-1.5 rounded text-[10px] font-medium transition-colors bg-base-200 text-base-content/60 hover:text-base-content hover:bg-base-200/80">
                        {preset.name}
                    </button>
                ))}
            </div>
        </Fieldset>

        <Fieldset legend="Shape and Scale">
            <Slider min={.5} value={padding} onChange={onChangePadding} label={"Padding"} format={formatPaddingValue} />

            <Slider max={100} value={borderRadius} onChange={onChangeBorderRadius} label={"Border Radius"}
                format={formatPx} />
        </Fieldset>

        <Fieldset legend="Shadow">
            <Slider value={shadowAlpha} onChange={onChangeShadowAlpha} label={"Shadow Alpha"} format={formatPercent} />
        </Fieldset>

        <div className="flex flex-col items-center gap-2 mt-4">
            <CroppingModal />
        </div>
    </Card>)
}