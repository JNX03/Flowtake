import { ComputerDesktopIcon } from "@heroicons/react/24/outline"
import { useCallback } from "react"
import {
    useDispatch,
    useSelector
} from "react-redux"
import {
    formatPercent,
    formatPx
} from "../../../../src/helpers"
import { withGroup } from "../../../../src/redux/actionEnhancers"
import {
    selectBorderRadius,
    selectPadding,
    selectShadowAlpha,
    setBorderRadius,
    setPadding,
    setShadowAlpha
} from "../../../../src/redux/projectSlice"
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

    return (<Card icon={<ComputerDesktopIcon className="w-6 h-6" />} title="Screen Recording">
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