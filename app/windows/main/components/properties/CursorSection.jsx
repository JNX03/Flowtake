import { CursorArrowRippleIcon } from "@heroicons/react/24/outline"
import { useCallback } from "react"
import {
    useDispatch,
    useSelector
} from "react-redux"
import {
    formatFixed,
    formatMs,
    formatPercent
} from "@shared/helpers"
import { withGroup } from "@shared/redux/actionEnhancers"
import {
    selectBlurStrength,
    selectCutOff,
    selectInertia,
    selectIsLoop,
    selectShowClickRing,
    setBlurStrength,
    setCutOff,
    setInertia,
    setIsLoop,
    setShowClickRing
} from "@shared/redux/cursorCoordsSlice"
import { selectIsStatic, setIsStatic } from "@shared/redux/cursorTypeSlice"
import {
    selectCursorFill,
    selectCursorMovementRotation,
    selectCursorScale,
    selectCursorShadowAlpha,
    setCursorFill,
    setCursorMovementRotation,
    setCursorScale,
    setCursorShadowAlpha,
    setCursorStroke
} from "@shared/redux/projectSlice"
import Card from "./Card"
import Fieldset from "./Fieldset"
import Slider from "./Slider"
import Toggle from "./Toggle"

export default function CursorSection() {

    const dispatch = useDispatch()

    const cursorScale = useSelector(selectCursorScale)
    const cursorFill = useSelector(selectCursorFill)
    const inertia = useSelector(selectInertia)
    const cutOff = useSelector(selectCutOff)
    const isLoop = useSelector(selectIsLoop)
    const blurStrength = useSelector(selectBlurStrength)
    const isStatic = useSelector(selectIsStatic)
    const cursorShadowAlpha = useSelector(selectCursorShadowAlpha)
    const cursorMovementRotation = useSelector(selectCursorMovementRotation)
    const showClickRing = useSelector(selectShowClickRing)

    const onChangeCursorScale = useCallback((value, group) => dispatch(withGroup(setCursorScale(value), group)), [dispatch])

    const onChangeTheme = useCallback(event => {
        dispatch(setCursorFill(event.target.checked ? "#fff" : "#000"))
        dispatch(setCursorStroke(event.target.checked ? "#000" : "#fff"))
    }, [dispatch])

    const onChangeInertia = useCallback((value, group) => dispatch(withGroup(setInertia(value), group)), [dispatch])

    const onChangeCutOff = useCallback((value, group) => dispatch(withGroup(setCutOff(value), group)), [dispatch])

    const onChangeIsLoop = useCallback(event => dispatch(setIsLoop(event.target.checked)), [dispatch])

    const onChangeBlurStrength = useCallback((value, group) => dispatch(withGroup(setBlurStrength(value), group)), [dispatch])

    const onChangeIsStatic = useCallback(event => dispatch(setIsStatic(!event.target.checked)), [dispatch])

    const onChangeCursorShadowAlpha = useCallback((value, group) => dispatch(withGroup(setCursorShadowAlpha(value), group)), [dispatch])

    const onChangeCursorMovementRotation = useCallback((value, group) => dispatch(withGroup(setCursorMovementRotation(value), group)), [dispatch])

    const onChangeShowClickRing = useCallback(event => dispatch(setShowClickRing(event.target.checked)), [dispatch])

    return (
        <Card icon={<CursorArrowRippleIcon className="w-6 h-6" />} title="Cursor">
            <>
                <Fieldset legend="Size">
                    <Slider min={0.01} max={0.06} value={cursorScale} onChange={onChangeCursorScale} label={"Size"} />
                </Fieldset>

                <Fieldset legend="Color Theme">
                    <Toggle leftLabel="Dark" rightLabel="Light" value={cursorFill === "#fff"} onChange={onChangeTheme} />
                </Fieldset>

                <Fieldset legend="Click Ring" description="Show a yellow ring effect around the cursor on mouse clicks. Individual click rings can be further customized in the timeline.">
                    <Toggle leftLabel="Click Ring" value={showClickRing} onChange={onChangeShowClickRing} />
                </Fieldset>

                <Fieldset legend="Smoothing" description="Cursor Smoothing removes jittery movements but can also remove some fidelity, e.g. near mouse clicks.">
                    <Slider min={100} max={2000} value={inertia} onChange={onChangeInertia} label={"Smoothing"} />
                </Fieldset>

                <Fieldset legend="Cursor Types" description="By default the cursor is context-sensitive. E.g. when hovering text the text selection cursor is used. Setting the cursor type to Static will always use the default cursor.">
                    <Toggle leftLabel="Static" rightLabel="Dynamic" value={!isStatic} onChange={onChangeIsStatic} />
                </Fieldset>

                <Fieldset legend="Blur Effect" description="Adding a Blur Effect to the cursor makes the recording look more dynamic.">
                    <Slider value={blurStrength} onChange={onChangeBlurStrength} label={"Effect Strength"}
                        format={formatFixed} />
                </Fieldset>

                <Fieldset legend="Shadow">
                    <Slider value={cursorShadowAlpha} onChange={onChangeCursorShadowAlpha} label={"Shadow Alpha"}
                        format={formatPercent} />
                </Fieldset>

                <Fieldset legend="Movement Rotation">
                    <Slider value={cursorMovementRotation} onChange={onChangeCursorMovementRotation} label={"Rotation"}
                        format={formatPercent} />
                </Fieldset>

                <Fieldset legend="End of the Video" description="Cut off the unwanted motion at the end, like the movement to the stop button. Cursor looping moves the cursor back to its initial position at the end of the video.">
                    <Slider max={3000} value={cutOff} onChange={onChangeCutOff} label="Cut off cursor movement"
                        format={formatMs} />
                    <Toggle leftLabel="Loop cursor" value={isLoop} onChange={onChangeIsLoop} />
                </Fieldset>
            </>
        </Card >
    )
}