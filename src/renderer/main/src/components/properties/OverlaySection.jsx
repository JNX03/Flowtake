import { Square2StackIcon } from "@heroicons/react/24/outline"
import {
    PlusIcon,
    TrashIcon
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
    addOverlayTrack,
    removeOverlay,
    selectAllOverlays,
    selectOverlayTracks,
    toggleOverlayTrackLock,
    toggleOverlayTrackVisibility,
    updateOverlay,
    updateOverlayTrack
} from "../../../../src/redux/overlaySlice"
import {
    selectSelectedIds,
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

    const opacity = useMemo(() => firstSelected?.opacity ?? 1, [firstSelected])

    const onOpacityChange = useCallback(value => {
        selectedIds.forEach(id => {
            dispatch(updateOverlay({ id, changes: { opacity: value } }))
        })
    }, [dispatch, selectedIds])

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
                {firstSelected && (
                    <Fieldset legend={`Selected ${firstSelected.overlayType || "Overlay"}`}>
                        <div className="flex flex-col gap-3">
                            <Slider
                                label="Opacity"
                                min={0}
                                max={1}
                                step={0.05}
                                value={opacity}
                                onChange={onOpacityChange}
                                format={formatPercent}
                            />

                            {firstSelected.overlayType === "text" && (<>
                                <label className="fieldset-label">Text</label>
                                <textarea
                                    value={firstSelected.text || ""}
                                    onChange={e => onTextChange(e.target.value)}
                                    className="textarea textarea-sm w-full bg-base-300"
                                    rows={2}
                                />
                                <Slider
                                    label="Font Size"
                                    min={12}
                                    max={120}
                                    step={1}
                                    value={firstSelected.fontSize || 32}
                                    onChange={onFontSizeChange}
                                    format={v => `${v}px`}
                                />
                                <label className="fieldset-label">Color</label>
                                <input
                                    type="color"
                                    value={firstSelected.color || "#ffffff"}
                                    onChange={e => onColorChange(e.target.value)}
                                    className="w-full h-8 rounded cursor-pointer"
                                />
                            </>)}

                            {firstSelected.overlayType === "shape" && (<>
                                <label className="fieldset-label">Fill Color</label>
                                <input
                                    type="color"
                                    value={firstSelected.fill || "#6C5CE7"}
                                    onChange={e => {
                                        selectedIds.forEach(id => {
                                            dispatch(updateOverlay({ id, changes: { fill: e.target.value } }))
                                        })
                                    }}
                                    className="w-full h-8 rounded cursor-pointer"
                                />
                                <Slider
                                    label="Width"
                                    min={20}
                                    max={800}
                                    step={10}
                                    value={firstSelected.width || 200}
                                    onChange={v => {
                                        selectedIds.forEach(id => {
                                            dispatch(updateOverlay({ id, changes: { width: v } }))
                                        })
                                    }}
                                    format={v => `${v}px`}
                                />
                                <Slider
                                    label="Height"
                                    min={20}
                                    max={600}
                                    step={10}
                                    value={firstSelected.height || 100}
                                    onChange={v => {
                                        selectedIds.forEach(id => {
                                            dispatch(updateOverlay({ id, changes: { height: v } }))
                                        })
                                    }}
                                    format={v => `${v}px`}
                                />
                                <Slider
                                    label="Border Radius"
                                    min={0}
                                    max={100}
                                    step={1}
                                    value={firstSelected.borderRadius || 0}
                                    onChange={v => {
                                        selectedIds.forEach(id => {
                                            dispatch(updateOverlay({ id, changes: { borderRadius: v } }))
                                        })
                                    }}
                                    format={v => `${v}px`}
                                />
                            </>)}

                            {firstSelected.overlayType === "image" && (<>
                                <label className="fieldset-label">Dimensions</label>
                                <div className="flex gap-2">
                                    <Slider
                                        label="Width"
                                        min={20}
                                        max={1920}
                                        step={10}
                                        value={firstSelected.width || 320}
                                        onChange={v => {
                                            selectedIds.forEach(id => {
                                                dispatch(updateOverlay({ id, changes: { width: v } }))
                                            })
                                        }}
                                        format={v => `${v}px`}
                                    />
                                </div>
                            </>)}

                            <div className="flex justify-end pt-2">
                                <button className="btn btn-xs btn-error btn-outline gap-1" onClick={onDelete}>
                                    <TrashIcon className="size-3" />
                                    Delete
                                </button>
                            </div>
                        </div>
                    </Fieldset>
                )}

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
