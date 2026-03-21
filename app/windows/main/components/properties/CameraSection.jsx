import { VideoCameraIcon } from "@heroicons/react/24/outline"
import { useCallback } from "react"
import {
    useDispatch,
    useSelector
} from "react-redux"
import { formatPercent } from "@shared/helpers"
import { withGroup } from "@shared/redux/actionEnhancers"
import {
    selectCameraVideoBackgroundBlurAmount,
    selectCameraVideoShadowAlpha,
    selectHasCameraVideoBackgroundBlur,
    selectIsCameraVideoMirrored,
    setCameraVideoBackgroundBlurAmount, setCameraVideoShadowAlpha,
    setHasCameraVideoBackgroundBlur,
    setIsCameraVideoMirrored
} from "@shared/redux/projectSlice"
import Card from "./Card"
import Fieldset from "./Fieldset"
import Slider from "./Slider"
import Toggle from "./Toggle"

export default function CameraSection() {

    const dispatch = useDispatch()

    const cameraVideoShadowAlpha = useSelector(selectCameraVideoShadowAlpha)
    const hasCameraVideoBackgroundBlur = useSelector(selectHasCameraVideoBackgroundBlur)
    const cameraVideoBackgroundBlurAmount = useSelector(selectCameraVideoBackgroundBlurAmount)
    const isCameraVideoMirrored = useSelector(selectIsCameraVideoMirrored)

    const onChangeShadowAlpha = useCallback((value, group) =>
        dispatch(withGroup(setCameraVideoShadowAlpha(value), group)),
        [dispatch])

    const onChangeHasBackgroundBlur = useCallback(event =>
        dispatch(setHasCameraVideoBackgroundBlur(event.target.checked)),
        [dispatch])

    const onChangeBackgroundBlurAmount = useCallback((value, group) =>
        dispatch(withGroup(setCameraVideoBackgroundBlurAmount(value), group)),
        [dispatch])

    const onChangeIsCameraVideoMirrored = useCallback(event =>
        dispatch(setIsCameraVideoMirrored(event.target.checked)),
        [dispatch])

    return (<Card icon={<VideoCameraIcon className="w-6 h-6" />} title="Camera Recording">
        <Fieldset legend="Shadow">
            <Slider value={cameraVideoShadowAlpha} onChange={onChangeShadowAlpha} label={"Shadow Alpha"}
                format={formatPercent} />
        </Fieldset>

        <Fieldset legend="Background Blur">
            <Toggle leftLabel="Blur" value={hasCameraVideoBackgroundBlur} onChange={onChangeHasBackgroundBlur} />

            {hasCameraVideoBackgroundBlur && <Slider min={0} max={1} step={.01}
                value={cameraVideoBackgroundBlurAmount} onChange={onChangeBackgroundBlurAmount}
                label={"Effect Strength"} format={formatPercent} />}
        </Fieldset>

        <Fieldset legend="Mirror Video">
            <Toggle leftLabel="Mirror" value={isCameraVideoMirrored} onChange={onChangeIsCameraVideoMirrored} />
        </Fieldset>
    </Card>)
}

