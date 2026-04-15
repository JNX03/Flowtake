import {
    AdjustmentsHorizontalIcon,
    FilmIcon,
    MicrophoneIcon,
    SpeakerWaveIcon,
    SpeakerXMarkIcon,
} from "@heroicons/react/24/outline"
import {
    useCallback,
    useMemo
} from "react"
import {
    shallowEqual,
    useDispatch,
    useSelector
} from "react-redux"
import {
    MODE_CAMERA_FULLSCREEN,
    MODE_CAMERA_OVERLAY,
    MODE_SCREEN_FULLSCREEN,
    MODE_SIDE_BY_SIDE,
    POS_BOTTOM_LEFT,

    POS_BOTTOM_RIGHT,
    POS_TOP_LEFT,
    POS_TOP_RIGHT
} from "@shared/constants"
import Button from "../../../../components/Button"
import {
    clamp,
    formatPercent,
    formatX,
    TOAST_SUCCESS
} from "@shared/helpers"
import { withGroup } from "@shared/redux/actionEnhancers"
import { addToast } from "@shared/redux/appSlice"
import {
    CAMERA_OVERLAY_DEFAULT_CONFIG,
    selectClipEntities,
    selectPlaybackRate,
    setLayout,
    setMicrophoneAudioVolume,
    setPlaybackRate,
    setSystemAudioVolume,
    SIDE_BY_SIDE_DEFAULT_CONFIG,
    updateClips
} from "@shared/redux/clipSlice"
import {
    selectIsMicrophoneMuted,
    selectIsSystemAudioMuted,
    setIsMicrophoneMuted,
    setIsSystemAudioMuted,
} from "@shared/redux/editorSlice"
import {
    selectAspectRatio,
    selectHasCameraVideo,
    selectHasMicrophoneAudio,
    selectHasSystemAudio
} from "@shared/redux/projectSlice"
import {
    selectSelectedIds
} from "@shared/redux/timelineSlice"
import CameraOverlayLayoutButton from "./CameraOverlayLayoutButton"
import Card from "./Card"
import CoordPicker from "./CoordPicker"
import Fieldset from "./Fieldset"
import OnlyCameraLayoutButton from "./OnlyCameraLayoutButton"
import OnlyScreenLayoutButton from "./OnlyScreenLayoutButton"
import SideBySideLayoutButton from "./SideBySideLayoutButton"
import Slider from "./Slider"
import SpeedSection from "./SpeedSection"
import TransitionPicker from "./TransitionPicker"

const PLAYBACK_RATE_MIN = 1
const PLAYBACK_RATE_MAX = 16

export default function ClipSection() {

    const dispatch = useDispatch()

    const selectedIds = useSelector(selectSelectedIds, shallowEqual)
    const aspectRatio = useSelector(selectAspectRatio)
    const hasCameraVideo = useSelector(selectHasCameraVideo)
    const entities = useSelector(selectClipEntities)
    const defaultPlaybackRate = useSelector(selectPlaybackRate)
    const hasMicrophoneAudio = useSelector(selectHasMicrophoneAudio)
    const hasSystemAudio = useSelector(selectHasSystemAudio)
    const isMicrophoneMuted = useSelector(selectIsMicrophoneMuted)
    const isSystemAudioMuted = useSelector(selectIsSystemAudioMuted)

    const configs = useMemo(
        () => selectedIds.map(id => entities[id]).filter(Boolean),
        [selectedIds, entities])

    const layoutMode = useMemo(
        () => configs.every(({ layout }) => layout.mode === configs[0]?.layout.mode) && configs[0]?.layout.mode
            ? configs[0]?.layout.mode
            : null,
        [configs])

    const cameraPosition = useMemo(
        () => (layoutMode === MODE_CAMERA_OVERLAY || layoutMode === MODE_SIDE_BY_SIDE)
            && configs.every(({ layout }) => layout.config?.cameraPosition === configs[0]?.layout.config?.cameraPosition)
            && configs[0]?.layout.config?.cameraPosition
            ? configs[0]?.layout.config?.cameraPosition
            : null,
        [layoutMode, configs])

    const isIndeterminatePlaybackRate = useMemo(
        () => !configs.every(({ playbackRate }) => playbackRate === configs[0]?.playbackRate),
        [configs])

    const isIndeterminateMicrophoneAudioVolume = useMemo(
        () => !configs.every(({ microphoneAudioVolume }) => microphoneAudioVolume === configs[0]?.microphoneAudioVolume),
        [configs])

    const isIndeterminateSystemAudioVolume = useMemo(
        () => !configs.every(({ systemAudioVolume }) => systemAudioVolume === configs[0]?.systemAudioVolume),
        [configs])

    const isIndeterminateCameraOverlayCameraBaseScale = useMemo(
        () => layoutMode === MODE_CAMERA_OVERLAY
            && !configs.every(({ layout }) => layout.config?.cameraBaseScale === configs[0]?.layout.config?.cameraBaseScale),
        [layoutMode, configs])

    const isIndeterminateCameraOverlayCameraBorderRadius = useMemo(
        () => layoutMode === MODE_CAMERA_OVERLAY
            && !configs.every(({ layout }) => layout.config?.cameraBorderRadius === configs[0]?.layout.config?.cameraBorderRadius),
        [layoutMode, configs])

    const isIndeterminateSideBySideCameraBorderRadius = useMemo(
        () => layoutMode === MODE_SIDE_BY_SIDE
            && !configs.every(({ layout }) => layout.config?.cameraBorderRadius === configs[0]?.layout.config?.cameraBorderRadius),
        [layoutMode, configs])

    const onChangePlaybackRate = useCallback((playbackRate, group) =>
        dispatch(updateClips(configs.map(({ id }) => ({ id, changes: { playbackRate } })), group)),
        [dispatch, configs])

    const onChangePlaybackRateInput = useCallback(({ target }) => {
        const playbackRate = clamp(Number(target.value), PLAYBACK_RATE_MIN, PLAYBACK_RATE_MAX)
        dispatch(updateClips(configs.map(({ id }) => ({ id, changes: { playbackRate } }))))
    }, [dispatch, configs])

    const onChangeLayoutMode = useCallback(mode => {
        switch (mode) {
            case MODE_CAMERA_OVERLAY:
                dispatch(updateClips(configs.map(({ id }) => ({
                    id,
                    changes: {
                        layout: {
                            mode: MODE_CAMERA_OVERLAY,
                            config: CAMERA_OVERLAY_DEFAULT_CONFIG
                        }
                    }
                }))))
                break
            case MODE_CAMERA_FULLSCREEN:
                dispatch(updateClips(configs.map(({ id }) => ({
                    id,
                    changes: { layout: { mode: MODE_CAMERA_FULLSCREEN } }
                }))))
                break
            case MODE_SCREEN_FULLSCREEN:
                dispatch(updateClips(configs.map(({ id }) => ({
                    id,
                    changes: { layout: { mode: MODE_SCREEN_FULLSCREEN } }
                }))))
                break
            case MODE_SIDE_BY_SIDE:
                dispatch(updateClips(configs.map(({ id }) => ({
                    id,
                    changes: {
                        layout: {
                            mode: MODE_SIDE_BY_SIDE,
                            config: {
                                ...SIDE_BY_SIDE_DEFAULT_CONFIG,
                                cameraPosition: aspectRatio === "9x16" ? "top" : "right"
                            }
                        }
                    }
                }))))
                break
        }
    }, [dispatch, configs, aspectRatio])

    const setCameraOverlayConfig = useCallback((layoutConfig, group) => {
        const action = updateClips(configs.map(config => ({
            id: config.id,
            changes: { layout: { mode: MODE_CAMERA_OVERLAY, config: { ...config.layout.config, ...layoutConfig } } }
        })))
        if (group) dispatch(withGroup(action, group))
        else dispatch(action)
    }, [dispatch, configs])

    const onChangeCameraOverlayPosition = useCallback(
        (cameraPosition, group) => setCameraOverlayConfig({ cameraPosition }, group),
        [setCameraOverlayConfig])

    const onChangeCameraOverlayScale = useCallback((cameraBaseScale, group) =>
        setCameraOverlayConfig({ cameraBaseScale }, group),
        [setCameraOverlayConfig])

    const onChangeCameraOverlayBorderRadius = useCallback((cameraBorderRadius, group) =>
        setCameraOverlayConfig({ cameraBorderRadius }, group),
        [setCameraOverlayConfig])

    const setSideBySideConfig = useCallback((layoutConfig, group) => {
        const action = updateClips(configs.map(config => ({
            id: config.id,
            changes: { layout: { mode: MODE_SIDE_BY_SIDE, config: { ...config.layout.config, ...layoutConfig } } }
        })))
        if (group) dispatch(action)
        else dispatch(withGroup(action, group))
    }, [dispatch, configs])

    const onChangeSideBySideBorderRadius = useCallback((cameraBorderRadius, group) =>
        setSideBySideConfig({ cameraBorderRadius }, group),
        [setSideBySideConfig])

    const onChangeSideBySideCameraPosition = useCallback(cameraPosition =>
        setSideBySideConfig({ cameraPosition }),
        [setSideBySideConfig])

    const onChangeMicrophoneAudioVolume = useCallback((microphoneAudioVolume, group) =>
        dispatch(updateClips(configs.map(({ id }) => ({ id, changes: { microphoneAudioVolume } })), group)),
        [dispatch, configs])

    const onChangeSystemAudioVolume = useCallback((systemAudioVolume, group) =>
        dispatch(updateClips(configs.map(({ id }) => ({ id, changes: { systemAudioVolume } })), group)),
        [dispatch, configs])

    const setAsDefault = useCallback(() => {
        if (layoutMode && !isIndeterminateCameraOverlayCameraBaseScale
            && !isIndeterminateCameraOverlayCameraBorderRadius
            && !isIndeterminateSideBySideCameraBorderRadius)
            dispatch(setLayout(configs[0].layout))
        if (!isIndeterminatePlaybackRate) dispatch(setPlaybackRate(configs[0].playbackRate))
        if (!isIndeterminateMicrophoneAudioVolume) dispatch(setMicrophoneAudioVolume(configs[0].microphoneAudioVolume))
        if (!isIndeterminateSystemAudioVolume) dispatch(setSystemAudioVolume(configs[0].systemAudioVolume))
        dispatch(addToast({ type: TOAST_SUCCESS, text: "Defaults updated" }))
    }, [dispatch, configs, layoutMode, isIndeterminateCameraOverlayCameraBaseScale,
        isIndeterminateCameraOverlayCameraBorderRadius, isIndeterminateSideBySideCameraBorderRadius,
        isIndeterminatePlaybackRate, isIndeterminateMicrophoneAudioVolume, isIndeterminateSystemAudioVolume])

    return (
        <Card icon={<FilmIcon className="w-6 h-6" />} title="Clip" showClose={true}>
            {hasCameraVideo && <>

                <Fieldset legend="Layout">
                    <div className="grid grid-cols-2 gap-1">
                        <CameraOverlayLayoutButton onClick={() => onChangeLayoutMode(MODE_CAMERA_OVERLAY)}
                            isActive={layoutMode === MODE_CAMERA_OVERLAY} cameraPosition={POS_BOTTOM_LEFT}
                            disabled={configs.length === 0} />
                        <OnlyCameraLayoutButton onClick={() => onChangeLayoutMode(MODE_CAMERA_FULLSCREEN)}
                            isActive={layoutMode === MODE_CAMERA_FULLSCREEN} disabled={configs.length === 0} />
                        <OnlyScreenLayoutButton onClick={() => onChangeLayoutMode(MODE_SCREEN_FULLSCREEN)}
                            isActive={layoutMode === MODE_SCREEN_FULLSCREEN} disabled={configs.length === 0} />
                        <SideBySideLayoutButton onClick={() => onChangeLayoutMode(MODE_SIDE_BY_SIDE)}
                            cameraPosition={aspectRatio === "9x16" ? "top" : "right"}
                            isActive={layoutMode === MODE_SIDE_BY_SIDE} disabled={configs.length === 0} />
                    </div>
                </Fieldset>

                {layoutMode === MODE_CAMERA_OVERLAY && cameraPosition && <Fieldset legend="Layout Settings">
                    <div className="tabs tabs-lift tabs-xs">
                        <input type="radio" name="layout_position" className="tab" aria-label="Corners"
                            defaultChecked={shallowEqual(cameraPosition, POS_TOP_LEFT)
                                || shallowEqual(cameraPosition, POS_TOP_RIGHT)
                                || shallowEqual(cameraPosition, POS_BOTTOM_LEFT)
                                || shallowEqual(cameraPosition, POS_BOTTOM_RIGHT)} />
                        <div className="tab-content border-base-300 bg-base-100 p-4 h-auto!">
                            <div className="w-full grid grid-cols-2 gap-1">
                                <CameraOverlayLayoutButton onClick={() => onChangeCameraOverlayPosition(POS_TOP_LEFT)}
                                    isActive={shallowEqual(cameraPosition, POS_TOP_LEFT)}
                                    cameraPosition={POS_TOP_LEFT} />
                                <CameraOverlayLayoutButton onClick={() => onChangeCameraOverlayPosition(POS_TOP_RIGHT)}
                                    isActive={shallowEqual(cameraPosition, POS_TOP_RIGHT)}
                                    cameraPosition={POS_TOP_RIGHT} />
                                <CameraOverlayLayoutButton onClick={() => onChangeCameraOverlayPosition(POS_BOTTOM_LEFT)}
                                    isActive={shallowEqual(cameraPosition, POS_BOTTOM_LEFT)}
                                    cameraPosition={POS_BOTTOM_LEFT} />
                                <CameraOverlayLayoutButton onClick={() => onChangeCameraOverlayPosition(POS_BOTTOM_RIGHT)}
                                    isActive={shallowEqual(cameraPosition, POS_BOTTOM_RIGHT)}
                                    cameraPosition={POS_BOTTOM_RIGHT} />
                            </div>
                        </div>

                        <input type="radio" name="layout_position" className="tab" aria-label="Free"
                            defaultChecked={!shallowEqual(cameraPosition, POS_TOP_LEFT)
                                && !shallowEqual(cameraPosition, POS_TOP_RIGHT)
                                && !shallowEqual(cameraPosition, POS_BOTTOM_LEFT)
                                && !shallowEqual(cameraPosition, POS_BOTTOM_RIGHT)} />
                        <div className="tab-content border-base-300 bg-base-100 p-4 h-auto!">
                            <CoordPicker coords={cameraPosition} onChange={onChangeCameraOverlayPosition} />
                        </div>
                    </div>

                    <Slider min={.01}
                        value={configs[0]?.layout.config?.cameraBaseScale ?? CAMERA_OVERLAY_DEFAULT_CONFIG.cameraBaseScale}
                        isIndeterminate={isIndeterminateCameraOverlayCameraBaseScale}
                        onChange={onChangeCameraOverlayScale} label={"Camera Size"} format={formatPercent} />

                    <Slider max={.5}
                        value={configs[0]?.layout.config?.cameraBorderRadius ?? CAMERA_OVERLAY_DEFAULT_CONFIG.cameraBorderRadius}
                        isIndeterminate={isIndeterminateCameraOverlayCameraBorderRadius}
                        onChange={onChangeCameraOverlayBorderRadius} label={"Camera Border Radius"}
                        format={formatPercent} />

                </Fieldset>}

                {layoutMode === MODE_SIDE_BY_SIDE && <Fieldset legend="Layout Settings">

                    <label className="fieldset-label">Camera Position</label>
                    <div className="w-full grid grid-cols-2 gap-1">
                        {(aspectRatio === "16x9" || aspectRatio === "1x1") && <SideBySideLayoutButton
                            cameraPosition="left" onClick={() => onChangeSideBySideCameraPosition("left")}
                            isActive={cameraPosition === "left"} />}
                        {(aspectRatio === "16x9" || aspectRatio === "1x1") && <SideBySideLayoutButton
                            cameraPosition="right" onClick={() => onChangeSideBySideCameraPosition("right")}
                            isActive={cameraPosition === "right"} />}
                        {(aspectRatio === "9x16" || aspectRatio === "1x1") && <SideBySideLayoutButton
                            cameraPosition="top" onClick={() => onChangeSideBySideCameraPosition("top")}
                            isActive={cameraPosition === "top"} />}
                        {(aspectRatio === "9x16" || aspectRatio === "1x1") && <SideBySideLayoutButton
                            cameraPosition="bottom" onClick={() => onChangeSideBySideCameraPosition("bottom")}
                            isActive={cameraPosition === "bottom"} />}
                    </div>

                    <Slider max={.5}
                        value={configs[0]?.layout.config?.cameraBorderRadius ?? SIDE_BY_SIDE_DEFAULT_CONFIG.cameraBorderRadius}
                        isIndeterminate={isIndeterminateSideBySideCameraBorderRadius}
                        onChange={onChangeSideBySideBorderRadius} label={"Camera Border Radius"}
                        format={formatPercent} />

                </Fieldset>}
            </>}

            <Fieldset legend="Playback Speed">
                <div className="tabs tabs-lift tabs-xs">
                    <input type="radio" name="playback_speed" className="tab" aria-label="Basic"
                        defaultChecked={configs[0]?.playbackRate <= 5} />
                    <div className="tab-content border-base-300 bg-base-100 p-4 h-auto!">
                        <Slider min={1} max={5} value={configs[0]?.playbackRate ?? defaultPlaybackRate}
                            isIndeterminate={isIndeterminatePlaybackRate} onChange={onChangePlaybackRate} label={"Speed"}
                            format={formatX} disabled={configs.length === 0} />
                    </div>

                    <input type="radio" name="playback_speed" className="tab" aria-label="Advanced"
                        defaultChecked={configs[0]?.playbackRate > 5} />
                    <div className="tab-content border-base-300 bg-base-100 p-4 h-auto!">
                        <fieldset className="fieldset">
                            <p className="label">Speed</p>
                            <label className="input">
                                <input value={configs[0]?.playbackRate ?? defaultPlaybackRate} onChange={onChangePlaybackRateInput}
                                    type="number" placeholder="Playback speed" required className="w-full"
                                    disabled={configs.length === 0} min={PLAYBACK_RATE_MIN} max={PLAYBACK_RATE_MAX} />
                                <span>×</span>
                            </label>
                            <p className="label">Must be between 1 and 16</p>
                        </fieldset>
                    </div>
                </div>

            </Fieldset>

            {(hasMicrophoneAudio || hasSystemAudio) &&
                <Fieldset legend="Audio">

                    {/* Source indicators */}
                    <div className="flex gap-1.5 mb-3">
                        {hasMicrophoneAudio && (
                            <span className="badge badge-sm gap-1 bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                                <MicrophoneIcon className="size-3" /> Mic
                            </span>
                        )}
                        {hasSystemAudio && (
                            <span className="badge badge-sm gap-1 bg-blue-500/10 text-blue-500 border-blue-500/20">
                                <SpeakerWaveIcon className="size-3" /> System
                            </span>
                        )}
                    </div>

                    {hasMicrophoneAudio && (
                        <div className="flex items-end gap-2">
                            <div className="flex-1">
                                <Slider value={isMicrophoneMuted ? 0 : (configs[0]?.microphoneAudioVolume ?? 1)}
                                    isIndeterminate={isIndeterminateMicrophoneAudioVolume}
                                    onChange={onChangeMicrophoneAudioVolume}
                                    label={"Microphone Volume"} format={formatPercent}
                                    disabled={isMicrophoneMuted} />
                            </div>
                            <button
                                className={`btn btn-ghost btn-xs btn-square mb-0.5 ${isMicrophoneMuted ? "text-warning" : "text-base-content/40"}`}
                                onClick={() => dispatch(setIsMicrophoneMuted(!isMicrophoneMuted))}
                                title={isMicrophoneMuted ? "Unmute microphone" : "Mute microphone"}
                            >
                                {isMicrophoneMuted ? <SpeakerXMarkIcon className="size-3.5" /> : <MicrophoneIcon className="size-3.5" />}
                            </button>
                        </div>
                    )}

                    {hasSystemAudio && (
                        <div className="flex items-end gap-2">
                            <div className="flex-1">
                                <Slider value={isSystemAudioMuted ? 0 : (configs[0]?.systemAudioVolume ?? 1)}
                                    isIndeterminate={isIndeterminateSystemAudioVolume}
                                    onChange={onChangeSystemAudioVolume}
                                    label={"System Audio Volume"} format={formatPercent}
                                    disabled={isSystemAudioMuted} />
                            </div>
                            <button
                                className={`btn btn-ghost btn-xs btn-square mb-0.5 ${isSystemAudioMuted ? "text-warning" : "text-base-content/40"}`}
                                onClick={() => dispatch(setIsSystemAudioMuted(!isSystemAudioMuted))}
                                title={isSystemAudioMuted ? "Unmute system audio" : "Mute system audio"}
                            >
                                {isSystemAudioMuted ? <SpeakerXMarkIcon className="size-3.5" /> : <SpeakerWaveIcon className="size-3.5" />}
                            </button>
                        </div>
                    )}

                </Fieldset>}

            {configs.length === 1 && (
                <Fieldset legend="Speed">
                    <SpeedSection />
                </Fieldset>
            )}

            {configs.length === 1 && (
                <Fieldset legend="Transitions">
                    <TransitionPicker />
                </Fieldset>
            )}

            <div className="mt-4 flex justify-center">
                <Button icon={AdjustmentsHorizontalIcon} onClick={setAsDefault} disabled={configs.length === 0}>
                    Set as default
                </Button>
            </div>
        </Card>
    )
}