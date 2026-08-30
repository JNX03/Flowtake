import { Square2StackIcon } from "@heroicons/react/24/outline"
import {
    KeyIcon,
    PlusIcon,
    TrashIcon,
    XMarkIcon
} from "@heroicons/react/16/solid"
import {
    useCallback,
    useMemo
} from "react"
import {
    useDispatch,
    useSelector
} from "react-redux"
import { formatPercent } from "@shared/helpers"
import { OVERLAY_EASING_NAMES } from "@shared/editor/overlayKeyframes"
import { clampVideoOverlayEnd } from "@shared/editor/videoOverlay"
import { getGroup, withGroup } from "@shared/redux/actionEnhancers"
import { selectDuration } from "@shared/redux/editorSlice"
import {
    addKeyframe,
    addOverlayTrack,
    removeKeyframe,
    removeOverlay,
    selectAllOverlays,
    selectOverlayTracks,
    updateOverlay,
    updateOverlayTrack
} from "@shared/redux/overlaySlice"
import {
    selectSelectedIds,
    selectTime,
    setSelectedIds
} from "@shared/redux/timelineSlice"
import Card from "./Card"
import Fieldset from "./Fieldset"
import Slider from "./Slider"

const BLEND_MODES = [
    "normal",
    "multiply",
    "screen",
    "overlay",
    "darken",
    "lighten",
    "difference",
]

const FONT_FAMILIES = [
    ["Inter", "Inter, Arial, Helvetica, sans-serif"],
    ["Arial", "Arial, Helvetica, sans-serif"],
    ["Georgia", "Georgia, Times New Roman, serif"],
    ["Monospace", "ui-monospace, SFMono-Regular, Consolas, monospace"],
]

export default function OverlaySection() {

    const dispatch = useDispatch()

    const selectedIds = useSelector(selectSelectedIds)
    const allOverlays = useSelector(selectAllOverlays)
    const tracks = useSelector(selectOverlayTracks)

    const selectedOverlays = useMemo(
        () => selectedIds.map(id => allOverlays.find(o => o.id === id)).filter(Boolean),
        [selectedIds, allOverlays]
    )

    const firstSelected = selectedOverlays[0]

    const time = useSelector(selectTime)
    const projectDuration = useSelector(selectDuration)

    const opacity = useMemo(() => firstSelected?.opacity ?? 1, [firstSelected])
    const rotation = useMemo(() => firstSelected?.rotation ?? 0, [firstSelected])
    const scale = useMemo(() => firstSelected?.scale ?? 1, [firstSelected])
    const posX = useMemo(() => firstSelected?.position?.x ?? 0.5, [firstSelected])
    const posY = useMemo(() => firstSelected?.position?.y ?? 0.5, [firstSelected])

    const updateSelected = useCallback((changes, group) => {
        const actionGroup = group || getGroup("overlay-property")
        selectedIds.forEach(id => {
            const overlay = allOverlays.find(item => item.id === id)
            if (!overlay) return
            const nextChanges = typeof changes === "function" ? changes(overlay) : changes
            if (!nextChanges || Object.keys(nextChanges).length === 0) return
            dispatch(withGroup(updateOverlay({ id, changes: nextChanges }), actionGroup))
        })
    }, [allOverlays, dispatch, selectedIds])

    const updateVideoSettings = useCallback((changes, group) => {
        updateSelected(overlay => {
            if (overlay.overlayType !== "video") return null
            const merged = { ...overlay, ...changes }
            if (merged.loop) return changes
            return {
                ...changes,
                end: clampVideoOverlayEnd({
                    start: merged.start,
                    projectDuration,
                    sourceDuration: merged.sourceDuration,
                    sourceStart: merged.sourceStart,
                    playbackRate: merged.playbackRate,
                    requestedDuration: Math.max(1, overlay.end - overlay.start),
                }),
            }
        }, group)
    }, [projectDuration, updateSelected])

    const onOpacityChange = useCallback(
        (value, group) => updateSelected({ opacity: value }, group),
        [updateSelected]
    )

    const onRotationChange = useCallback(
        (value, group) => updateSelected({ rotation: value }, group),
        [updateSelected]
    )

    const onScaleChange = useCallback(
        (value, group) => updateSelected({ scale: value }, group),
        [updateSelected]
    )

    const onPosXChange = useCallback(
        (value, group) => updateSelected(
            overlay => ({ position: { ...overlay.position, x: value } }),
            group
        ),
        [updateSelected]
    )

    const onPosYChange = useCallback(
        (value, group) => updateSelected(
            overlay => ({ position: { ...overlay.position, y: value } }),
            group
        ),
        [updateSelected]
    )

    const onAddKeyframe = useCallback(() => {
        if (!firstSelected) return
        const relTime = Math.max(0, time - firstSelected.start)
        dispatch(addKeyframe({
            overlayId: firstSelected.id,
            time: relTime,
            props: {
                position: firstSelected.position,
                rotation: firstSelected.rotation ?? 0,
                scale: firstSelected.scale ?? 1,
                opacity: firstSelected.opacity ?? 1,
                easing: "linear",
            }
        }))
    }, [dispatch, firstSelected, time])

    const onRemoveKeyframe = useCallback(kfTime => {
        if (!firstSelected) return
        dispatch(removeKeyframe({ overlayId: firstSelected.id, time: kfTime }))
    }, [dispatch, firstSelected])

    const onChangeKeyframeEasing = useCallback((kfTime, easing) => {
        if (!firstSelected || !OVERLAY_EASING_NAMES.includes(easing)) return
        dispatch(addKeyframe({
            overlayId: firstSelected.id,
            time: kfTime,
            props: { easing },
        }))
    }, [dispatch, firstSelected])

    const onTextChange = useCallback(
        text => updateSelected({ text }),
        [updateSelected]
    )

    const onFontSizeChange = useCallback(
        (value, group) => updateSelected({ fontSize: value }, group),
        [updateSelected]
    )

    const onColorChange = useCallback(
        color => updateSelected({ color }),
        [updateSelected]
    )

    const onDelete = useCallback(() => {
        const group = getGroup("overlay-delete")
        selectedIds.forEach(id => dispatch(withGroup(removeOverlay(id), group)))
        dispatch(setSelectedIds([]))
    }, [dispatch, selectedIds])

    const onAddTrack = useCallback(() => {
        dispatch(addOverlayTrack())
    }, [dispatch])

    const onRenameTrack = useCallback((id, name) => {
        dispatch(updateOverlayTrack({ id, changes: { name } }))
    }, [dispatch])

    return (
        <Card icon={<Square2StackIcon className="w-6 h-6" />} title="Overlays"
            showClose={selectedOverlays.length > 0}>
            <div className="flex flex-col gap-4">
                {/* Track Management */}
                <Fieldset legend="Tracks">
                    <div className="flex flex-col gap-2">
                        {tracks.map(track => (
                            <div key={track.id} className="flex items-center gap-2 px-2 py-1 bg-base-300 rounded-lg">
                                <div className="w-2 h-2 rounded-full bg-accent shrink-0" />
                                <input
                                    type="text"
                                    value={track.name}
                                    onChange={e => onRenameTrack(track.id, e.target.value)}
                                    className="input input-xs input-ghost flex-1 min-w-0 bg-transparent"
                                />
                            </div>
                        ))}
                        <button className="btn btn-xs btn-ghost gap-1" onClick={onAddTrack}>
                            <PlusIcon className="size-3" />
                            Add Overlay Track
                        </button>
                    </div>
                </Fieldset>

                {/* Selected Overlay Properties */}
                {firstSelected && (<>
                    {/* Transform */}
                    <Fieldset legend="Transform">
                        <div className="flex flex-col gap-2">
                            <Slider label="X Position" min={0} max={1} step={0.01}
                                value={posX} onChange={onPosXChange}
                                format={v => `${Math.round(v * 100)}%`} />
                            <Slider label="Y Position" min={0} max={1} step={0.01}
                                value={posY} onChange={onPosYChange}
                                format={v => `${Math.round(v * 100)}%`} />
                            <Slider label="Rotation" min={-180} max={180} step={1}
                                value={rotation} onChange={onRotationChange}
                                format={v => `${v} deg`} />
                            <Slider label="Scale" min={0.1} max={5} step={0.05}
                                value={scale} onChange={onScaleChange}
                                format={v => `${Math.round(v * 100)}%`} />
                            <Slider label="Opacity" min={0} max={1} step={0.05}
                                value={opacity} onChange={onOpacityChange}
                                format={formatPercent} />
                        </div>
                    </Fieldset>

                    <Fieldset legend="Appearance">
                        <div className="flex flex-col gap-3">
                            <label className="flex items-center justify-between gap-3 text-xs">
                                <span>Visible</span>
                                <input
                                    type="checkbox"
                                    checked={firstSelected.visible !== false}
                                    onChange={event => updateSelected({ visible: event.target.checked })}
                                    className="toggle toggle-xs toggle-info"
                                />
                            </label>
                            <label className="flex items-center justify-between gap-3 text-xs">
                                <span>Blend mode</span>
                                <select
                                    value={firstSelected.blendMode || "normal"}
                                    onChange={event => updateSelected({ blendMode: event.target.value })}
                                    className="select select-xs w-32"
                                >
                                    {BLEND_MODES.map(mode => (
                                        <option key={mode} value={mode}>{mode}</option>
                                    ))}
                                </select>
                            </label>
                        </div>
                    </Fieldset>

                    {/* Type-specific properties */}
                    <Fieldset legend={firstSelected.overlayType === "text" ? "Text" :
                        firstSelected.overlayType === "shape" ? "Shape" :
                        firstSelected.overlayType === "image" ? "Image" : "Properties"}>
                        <div className="flex flex-col gap-2">
                            {firstSelected.overlayType === "text" && (<>
                                <textarea
                                    value={firstSelected.text || ""}
                                    onChange={e => onTextChange(e.target.value)}
                                    className="textarea textarea-sm w-full bg-base-300"
                                    rows={2}
                                    aria-label="Overlay text"
                                />
                                <label className="fieldset-label">Font family</label>
                                <select
                                    value={firstSelected.fontFamily || FONT_FAMILIES[0][1]}
                                    onChange={event => updateSelected({ fontFamily: event.target.value })}
                                    className="select select-sm w-full"
                                >
                                    {FONT_FAMILIES.map(([label, value]) => (
                                        <option key={label} value={value}>{label}</option>
                                    ))}
                                </select>
                                <div className="grid grid-cols-2 gap-2">
                                    <label className="flex flex-col gap-1 text-xs">
                                        <span className="fieldset-label">Weight</span>
                                        <select
                                            value={firstSelected.fontWeight || 400}
                                            onChange={event => updateSelected({ fontWeight: Number(event.target.value) })}
                                            className="select select-xs w-full"
                                        >
                                            {[300, 400, 500, 600, 700, 800].map(weight => (
                                                <option key={weight} value={weight}>{weight}</option>
                                            ))}
                                        </select>
                                    </label>
                                    <label className="flex flex-col gap-1 text-xs">
                                        <span className="fieldset-label">Style</span>
                                        <select
                                            value={firstSelected.fontStyle || "normal"}
                                            onChange={event => updateSelected({ fontStyle: event.target.value })}
                                            className="select select-xs w-full"
                                        >
                                            <option value="normal">Regular</option>
                                            <option value="italic">Italic</option>
                                        </select>
                                    </label>
                                </div>
                                <div className="grid grid-cols-3 gap-1" role="group" aria-label="Text alignment">
                                    {["left", "center", "right"].map(align => (
                                        <button
                                            key={align}
                                            type="button"
                                            onClick={() => updateSelected({ textAlign: align })}
                                            className={`btn btn-xs ${(firstSelected.textAlign || "center") === align ? "btn-info" : "btn-ghost"}`}
                                            aria-pressed={(firstSelected.textAlign || "center") === align}
                                        >
                                            {align[0].toUpperCase() + align.slice(1)}
                                        </button>
                                    ))}
                                </div>
                                <Slider label="Font Size" min={12} max={120} step={1}
                                    value={firstSelected.fontSize || 32}
                                    onChange={onFontSizeChange}
                                    format={v => `${v}px`} />
                                <Slider label="Letter Spacing" min={-5} max={24} step={0.5}
                                    value={firstSelected.letterSpacing || 0}
                                    onChange={(value, group) => updateSelected({ letterSpacing: value }, group)}
                                    format={v => `${v}px`} />
                                <Slider label="Line Height" min={0.8} max={2.5} step={0.05}
                                    value={firstSelected.lineHeight || 1.3}
                                    onChange={(value, group) => updateSelected({ lineHeight: value }, group)}
                                    format={v => v.toFixed(2)} />
                                <Slider label="Text Width" min={160} max={1920} step={20}
                                    value={firstSelected.textMaxWidth || 800}
                                    onChange={(value, group) => updateSelected({ textMaxWidth: value }, group)}
                                    format={v => `${v}px`} />
                                <label className="fieldset-label">Color</label>
                                <input type="color" value={firstSelected.color || "#ffffff"}
                                    onChange={e => onColorChange(e.target.value)}
                                    className="w-full h-8 rounded cursor-pointer" />
                                <label className="flex items-center justify-between gap-3 text-xs pt-1">
                                    <span>Text background</span>
                                    <input
                                        type="checkbox"
                                        checked={Boolean(firstSelected.textBackgroundEnabled)}
                                        onChange={event => updateSelected({
                                            textBackgroundEnabled: event.target.checked,
                                        })}
                                        className="toggle toggle-xs toggle-info"
                                    />
                                </label>
                                {firstSelected.textBackgroundEnabled && (<>
                                    <label className="fieldset-label">Background color</label>
                                    <input
                                        type="color"
                                        value={firstSelected.textBackgroundColor || "#000000"}
                                        onChange={event => updateSelected({
                                            textBackgroundColor: event.target.value,
                                        })}
                                        className="w-full h-8 rounded cursor-pointer"
                                    />
                                    <Slider label="Background Opacity" min={0} max={1} step={0.05}
                                        value={firstSelected.textBackgroundOpacity ?? 0.65}
                                        onChange={(value, group) => updateSelected({
                                            textBackgroundOpacity: value,
                                        }, group)}
                                        format={formatPercent} />
                                    <Slider label="Background Padding" min={0} max={64} step={1}
                                        value={firstSelected.textBackgroundPadding ?? 12}
                                        onChange={(value, group) => updateSelected({
                                            textBackgroundPadding: value,
                                        }, group)}
                                        format={v => `${v}px`} />
                                    <Slider label="Background Radius" min={0} max={64} step={1}
                                        value={firstSelected.textBackgroundRadius ?? 8}
                                        onChange={(value, group) => updateSelected({
                                            textBackgroundRadius: value,
                                        }, group)}
                                        format={v => `${v}px`} />
                                </>)}
                            </>)}

                            {firstSelected.overlayType === "shape" && (<>
                                <label className="fieldset-label">Fill</label>
                                <input type="color" value={firstSelected.fill || "#6C5CE7"}
                                    onChange={e => updateSelected({ fill: e.target.value })}
                                    className="w-full h-8 rounded cursor-pointer" />
                                <label className="flex items-center justify-between gap-3 text-xs">
                                    <span>Outline</span>
                                    <input
                                        type="checkbox"
                                        checked={firstSelected.stroke !== "none" && Boolean(firstSelected.stroke)}
                                        onChange={event => updateSelected({
                                            stroke: event.target.checked ? "#ffffff" : "none",
                                        })}
                                        className="toggle toggle-xs toggle-info"
                                    />
                                </label>
                                {firstSelected.stroke !== "none" && Boolean(firstSelected.stroke) && (<>
                                    <input type="color" value={firstSelected.stroke || "#ffffff"}
                                        onChange={event => updateSelected({ stroke: event.target.value })}
                                        className="w-full h-8 rounded cursor-pointer"
                                        aria-label="Outline color" />
                                    <Slider label="Outline Width" min={1} max={32} step={1}
                                        value={firstSelected.strokeWidth || 2}
                                        onChange={(value, group) => updateSelected({ strokeWidth: value }, group)}
                                        format={v => `${v}px`} />
                                </>)}
                                <Slider label="Width" min={20} max={800} step={10}
                                    value={firstSelected.width || 200}
                                    onChange={(value, group) => updateSelected({ width: value }, group)}
                                    format={v => `${v}px`} />
                                <Slider label="Height" min={20} max={600} step={10}
                                    value={firstSelected.height || 100}
                                    onChange={(value, group) => updateSelected({ height: value }, group)}
                                    format={v => `${v}px`} />
                                <Slider label="Corner Radius" min={0} max={100} step={1}
                                    value={firstSelected.borderRadius || 0}
                                    onChange={(value, group) => updateSelected({ borderRadius: value }, group)}
                                    format={v => `${v}px`} />
                            </>)}

                            {firstSelected.overlayType === "image" && (<>
                                <Slider label="Width" min={20} max={1920} step={10}
                                    value={firstSelected.width || 320}
                                    onChange={(value, group) => updateSelected({ width: value }, group)}
                                    format={v => `${v}px`} />
                                <Slider label="Height" min={20} max={1080} step={10}
                                    value={firstSelected.height || 240}
                                    onChange={(value, group) => updateSelected({ height: value }, group)}
                                    format={v => `${v}px`} />
                            </>)}

                            {firstSelected.overlayType === "video" && (<>
                                <div className="rounded-md bg-base-300/70 px-2.5 py-2 text-[10px] text-base-content/55">
                                    {firstSelected.sourceDuration
                                        ? `Source ${(firstSelected.sourceDuration / 1000).toFixed(1)}s`
                                        : "Source duration is detected when the video loads."}
                                    {" "}Video overlays are visual-only; recorded project audio remains controlled at export.
                                </div>
                                <Slider label="Width" min={20} max={1920} step={10}
                                    value={firstSelected.width || 320}
                                    onChange={(value, group) => updateSelected({ width: value }, group)}
                                    format={v => `${v}px`} />
                                <Slider label="Height" min={20} max={1080} step={10}
                                    value={firstSelected.height || 240}
                                    onChange={(value, group) => updateSelected({ height: value }, group)}
                                    format={v => `${v}px`} />
                                <Slider label="Playback Speed" min={0.25} max={4} step={0.05}
                                    value={firstSelected.playbackRate || 1}
                                    onChange={(value, group) => updateVideoSettings({
                                        playbackRate: value,
                                    }, group)}
                                    format={v => `${v.toFixed(2)}x`} />
                                {Number(firstSelected.sourceDuration) > 100 && (
                                    <Slider label="Source Start" min={0}
                                        max={Math.max(0, firstSelected.sourceDuration - 100)}
                                        step={100}
                                        value={Math.min(
                                            firstSelected.sourceStart || 0,
                                            Math.max(0, firstSelected.sourceDuration - 100)
                                        )}
                                        onChange={(value, group) => updateVideoSettings({
                                            sourceStart: value,
                                        }, group)}
                                        format={v => `${(v / 1000).toFixed(1)}s`} />
                                )}
                                <label className="flex items-center justify-between gap-3 text-xs">
                                    <span>Loop video</span>
                                    <input
                                        type="checkbox"
                                        checked={Boolean(firstSelected.loop)}
                                        onChange={event => updateVideoSettings({
                                            loop: event.target.checked,
                                        })}
                                        className="toggle toggle-xs toggle-info"
                                    />
                                </label>
                            </>)}
                        </div>
                    </Fieldset>

                    {/* Keyframes */}
                    <Fieldset legend="Keyframes">
                        <div className="flex flex-col gap-2">
                            <button className="btn btn-xs btn-info btn-outline gap-1 w-full" onClick={onAddKeyframe}>
                                <KeyIcon className="size-3" />
                                Add keyframe at current time
                            </button>
                            {firstSelected.keyframes && firstSelected.keyframes.length > 0 ? (
                                <div className="flex flex-col gap-1 max-h-32 overflow-y-auto">
                                    {firstSelected.keyframes.map((kf, i) => (
                                        <div key={i} className="flex items-center gap-2 text-[10px] px-2 py-1 bg-base-300 rounded">
                                            <KeyIcon className="size-3 text-info shrink-0" />
                                            <span className="flex-1 font-mono opacity-70">
                                                {(kf.time / 1000).toFixed(1)}s
                                            </span>
                                            <span className="opacity-40">
                                                {kf.rotation != null && `${Math.round(kf.rotation)} deg `}
                                                {kf.scale != null && `${Math.round(kf.scale * 100)}%`}
                                            </span>
                                            <select
                                                value={kf.easing || "linear"}
                                                onChange={event => onChangeKeyframeEasing(kf.time, event.target.value)}
                                                className="select select-xs h-6 min-h-6 w-20"
                                                aria-label={`Easing for keyframe at ${(kf.time / 1000).toFixed(1)} seconds`}
                                            >
                                                {OVERLAY_EASING_NAMES.map(name => (
                                                    <option key={name} value={name}>{name}</option>
                                                ))}
                                            </select>
                                            <button className="btn btn-ghost btn-xs p-0 min-h-0 h-4 w-4 opacity-40 hover:opacity-100"
                                                onClick={() => onRemoveKeyframe(kf.time)}>
                                                <XMarkIcon className="size-3" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-[10px] opacity-30 text-center">No keyframes yet. Add keyframes to animate position, rotation, scale, and opacity over time.</p>
                            )}
                        </div>
                    </Fieldset>

                    <div className="flex justify-end pt-2">
                        <button className="btn btn-xs btn-error btn-outline gap-1" onClick={onDelete}>
                            <TrashIcon className="size-3" />
                            Delete
                        </button>
                    </div>
                </>)}

                {/* Instructions */}
                {selectedOverlays.length === 0 && (
                    <div className="text-xs opacity-40 text-center py-4">
                        Double-click on an overlay track to add text,<br />
                        or drag text/shapes/images from the Assets panel.
                    </div>
                )}
            </div>
        </Card>
    )
}
