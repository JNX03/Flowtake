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
import { formatPercent } from "../../../../src/helpers"
import {
    addKeyframe,
    addOverlayTrack,
    removeKeyframe,
    removeOverlay,
    selectAllOverlays,
    selectOverlayTracks,
    updateOverlay,
    updateOverlayTrack
} from "../../../../src/redux/overlaySlice"
import {
    selectSelectedIds,
    selectTime,
    setSelectedIds
} from "../../../../src/redux/timelineSlice"
import Card from "./Card"
import Fieldset from "./Fieldset"
import Slider from "./Slider"

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

    const opacity = useMemo(() => firstSelected?.opacity ?? 1, [firstSelected])
    const rotation = useMemo(() => firstSelected?.rotation ?? 0, [firstSelected])
    const scale = useMemo(() => firstSelected?.scale ?? 1, [firstSelected])
    const posX = useMemo(() => firstSelected?.position?.x ?? 0.5, [firstSelected])
    const posY = useMemo(() => firstSelected?.position?.y ?? 0.5, [firstSelected])

    const onOpacityChange = useCallback(value => {
        selectedIds.forEach(id => {
            dispatch(updateOverlay({ id, changes: { opacity: value } }))
        })
    }, [dispatch, selectedIds])

    const onRotationChange = useCallback(value => {
        selectedIds.forEach(id => {
            dispatch(updateOverlay({ id, changes: { rotation: value } }))
        })
    }, [dispatch, selectedIds])

    const onScaleChange = useCallback(value => {
        selectedIds.forEach(id => {
            dispatch(updateOverlay({ id, changes: { scale: value } }))
        })
    }, [dispatch, selectedIds])

    const onPosXChange = useCallback(value => {
        selectedIds.forEach(id => {
            const ov = allOverlays.find(o => o.id === id)
            if (ov) dispatch(updateOverlay({ id, changes: { position: { ...ov.position, x: value } } }))
        })
    }, [dispatch, selectedIds, allOverlays])

    const onPosYChange = useCallback(value => {
        selectedIds.forEach(id => {
            const ov = allOverlays.find(o => o.id === id)
            if (ov) dispatch(updateOverlay({ id, changes: { position: { ...ov.position, y: value } } }))
        })
    }, [dispatch, selectedIds, allOverlays])

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
            }
        }))
    }, [dispatch, firstSelected, time])

    const onRemoveKeyframe = useCallback(kfTime => {
        if (!firstSelected) return
        dispatch(removeKeyframe({ overlayId: firstSelected.id, time: kfTime }))
    }, [dispatch, firstSelected])

    const onTextChange = useCallback(text => {
        selectedIds.forEach(id => {
            dispatch(updateOverlay({ id, changes: { text } }))
        })
    }, [dispatch, selectedIds])

    const onFontSizeChange = useCallback(value => {
        selectedIds.forEach(id => {
            dispatch(updateOverlay({ id, changes: { fontSize: value } }))
        })
    }, [dispatch, selectedIds])

    const onColorChange = useCallback(color => {
        selectedIds.forEach(id => {
            dispatch(updateOverlay({ id, changes: { color } }))
        })
    }, [dispatch, selectedIds])

    const onDelete = useCallback(() => {
        selectedIds.forEach(id => dispatch(removeOverlay(id)))
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
                                format={v => `${v}°`} />
                            <Slider label="Scale" min={0.1} max={5} step={0.05}
                                value={scale} onChange={onScaleChange}
                                format={v => `${Math.round(v * 100)}%`} />
                            <Slider label="Opacity" min={0} max={1} step={0.05}
                                value={opacity} onChange={onOpacityChange}
                                format={formatPercent} />
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
                                />
                                <Slider label="Font Size" min={12} max={120} step={1}
                                    value={firstSelected.fontSize || 32}
                                    onChange={onFontSizeChange}
                                    format={v => `${v}px`} />
                                <label className="fieldset-label">Color</label>
                                <input type="color" value={firstSelected.color || "#ffffff"}
                                    onChange={e => onColorChange(e.target.value)}
                                    className="w-full h-8 rounded cursor-pointer" />
                            </>)}

                            {firstSelected.overlayType === "shape" && (<>
                                <label className="fieldset-label">Fill</label>
                                <input type="color" value={firstSelected.fill || "#6C5CE7"}
                                    onChange={e => {
                                        selectedIds.forEach(id => dispatch(updateOverlay({ id, changes: { fill: e.target.value } })))
                                    }}
                                    className="w-full h-8 rounded cursor-pointer" />
                                <Slider label="Width" min={20} max={800} step={10}
                                    value={firstSelected.width || 200}
                                    onChange={v => selectedIds.forEach(id => dispatch(updateOverlay({ id, changes: { width: v } })))}
                                    format={v => `${v}px`} />
                                <Slider label="Height" min={20} max={600} step={10}
                                    value={firstSelected.height || 100}
                                    onChange={v => selectedIds.forEach(id => dispatch(updateOverlay({ id, changes: { height: v } })))}
                                    format={v => `${v}px`} />
                                <Slider label="Corner Radius" min={0} max={100} step={1}
                                    value={firstSelected.borderRadius || 0}
                                    onChange={v => selectedIds.forEach(id => dispatch(updateOverlay({ id, changes: { borderRadius: v } })))}
                                    format={v => `${v}px`} />
                            </>)}

                            {firstSelected.overlayType === "image" && (<>
                                <Slider label="Width" min={20} max={1920} step={10}
                                    value={firstSelected.width || 320}
                                    onChange={v => selectedIds.forEach(id => dispatch(updateOverlay({ id, changes: { width: v } })))}
                                    format={v => `${v}px`} />
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
                                                {kf.rotation != null && `${Math.round(kf.rotation)}° `}
                                                {kf.scale != null && `${Math.round(kf.scale * 100)}%`}
                                            </span>
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
