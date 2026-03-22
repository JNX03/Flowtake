import {
    AdjustmentsHorizontalIcon,
    ArrowPathIcon
} from "@heroicons/react/24/outline"
import { useCallback } from "react"
import {
    useDispatch,
    useSelector
} from "react-redux"
import {
    resetFilters,
    selectBrightness,
    selectBlur,
    selectContrast,
    selectGamma,
    selectHue,
    selectSaturation,
    selectTemperature,
    selectVignette,
    setBrightness,
    setBlur,
    setContrast,
    setGamma,
    setHue,
    setSaturation,
    setTemperature,
    setVignette,
} from "@shared/redux/filterSlice"
import Card from "./Card"
import Fieldset from "./Fieldset"

const FILTER_PRESETS = [
    { name: "Normal", config: { brightness: 1, contrast: 1, saturation: 1, gamma: 1, blur: 0, hue: 0, temperature: 0, vignette: 0 } },
    { name: "Vivid", config: { brightness: 1.05, contrast: 1.2, saturation: 1.4, gamma: 1, blur: 0, hue: 0, temperature: 0.1, vignette: 0 } },
    { name: "Warm", config: { brightness: 1.05, contrast: 1.05, saturation: 1.1, gamma: 0.95, blur: 0, hue: 0, temperature: 0.4, vignette: 0 } },
    { name: "Cool", config: { brightness: 1, contrast: 1.1, saturation: 0.8, gamma: 1.05, blur: 0, hue: 0, temperature: -0.3, vignette: 0 } },
    { name: "B&W", config: { brightness: 1, contrast: 1.1, saturation: 0, gamma: 1, blur: 0, hue: 0, temperature: 0, vignette: 0 } },
    { name: "Cinematic", config: { brightness: 0.95, contrast: 1.3, saturation: 0.85, gamma: 1.1, blur: 0, hue: 0, temperature: 0.15, vignette: 0.4 } },
    { name: "Faded", config: { brightness: 1.1, contrast: 0.85, saturation: 0.7, gamma: 1.1, blur: 0, hue: 0, temperature: 0.1, vignette: 0.2 } },
    { name: "High Key", config: { brightness: 1.2, contrast: 0.9, saturation: 0.9, gamma: 0.9, blur: 0, hue: 0, temperature: 0, vignette: 0 } },
]

function FilterSlider({ label, value, min, max, step, onChange, format }) {
    return (
        <div className="flex items-center gap-2">
            <span className="text-[10px] opacity-50 w-16 shrink-0">{label}</span>
            <input type="range" min={min} max={max} step={step}
                value={value} onChange={e => onChange(Number(e.target.value))}
                className="range range-xs range-primary flex-1" />
            <span className="text-[10px] opacity-50 w-10 text-right font-mono">
                {format ? format(value) : value.toFixed(2)}
            </span>
        </div>
    )
}

export default function FilterSection() {
    const dispatch = useDispatch()

    const brightness = useSelector(selectBrightness)
    const contrast = useSelector(selectContrast)
    const saturation = useSelector(selectSaturation)
    const gamma = useSelector(selectGamma)
    const blur = useSelector(selectBlur)
    const hue = useSelector(selectHue)
    const temperature = useSelector(selectTemperature)
    const vignette = useSelector(selectVignette)

    const handleReset = useCallback(() => dispatch(resetFilters()), [dispatch])

    return (
        <Card icon={AdjustmentsHorizontalIcon} title="Filters">
            {/* Presets */}
            <Fieldset legend="Presets">
                <div className="grid grid-cols-4 gap-1">
                    {FILTER_PRESETS.map(preset => (
                        <button key={preset.name}
                            onClick={() => {
                                dispatch(setBrightness(preset.config.brightness))
                                dispatch(setContrast(preset.config.contrast))
                                dispatch(setSaturation(preset.config.saturation))
                                dispatch(setGamma(preset.config.gamma))
                                dispatch(setBlur(preset.config.blur))
                                dispatch(setHue(preset.config.hue))
                                dispatch(setTemperature(preset.config.temperature))
                                dispatch(setVignette(preset.config.vignette))
                            }}
                            className="px-1.5 py-1.5 rounded text-[10px] font-medium transition-colors bg-base-200 text-base-content/60 hover:text-base-content hover:bg-base-200/80">
                            {preset.name}
                        </button>
                    ))}
                </div>
            </Fieldset>

            {/* Adjustments */}
            <Fieldset legend="Adjustments">
                <div className="flex flex-col gap-2.5">
                    <FilterSlider label="Brightness" value={brightness} min={0} max={2} step={0.05}
                        onChange={v => dispatch(setBrightness(v))} />
                    <FilterSlider label="Contrast" value={contrast} min={0} max={2} step={0.05}
                        onChange={v => dispatch(setContrast(v))} />
                    <FilterSlider label="Saturation" value={saturation} min={0} max={2} step={0.05}
                        onChange={v => dispatch(setSaturation(v))} />
                    <FilterSlider label="Gamma" value={gamma} min={0.5} max={2} step={0.05}
                        onChange={v => dispatch(setGamma(v))} />
                    <FilterSlider label="Blur" value={blur} min={0} max={20} step={0.5}
                        onChange={v => dispatch(setBlur(v))} format={v => `${v.toFixed(1)}px`} />
                </div>
            </Fieldset>

            {/* Color */}
            <Fieldset legend="Color">
                <div className="flex flex-col gap-2.5">
                    <FilterSlider label="Hue" value={hue} min={-180} max={180} step={1}
                        onChange={v => dispatch(setHue(v))} format={v => `${v}°`} />
                    <FilterSlider label="Temperature" value={temperature} min={-1} max={1} step={0.05}
                        onChange={v => dispatch(setTemperature(v))} format={v => v > 0 ? `+${v.toFixed(2)}` : v.toFixed(2)} />
                    <FilterSlider label="Vignette" value={vignette} min={0} max={1} step={0.05}
                        onChange={v => dispatch(setVignette(v))} />
                </div>
            </Fieldset>

            <div className="mt-3 flex justify-center">
                <button onClick={handleReset}
                    className="btn btn-ghost btn-xs gap-1 text-base-content/50 hover:text-base-content">
                    <ArrowPathIcon className="size-3.5" />
                    Reset all
                </button>
            </div>
        </Card>
    )
}
