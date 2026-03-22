import { ChatBubbleOvalLeftIcon } from "@heroicons/react/24/outline"
import { useCallback } from "react"
import {
    useDispatch,
    useSelector
} from "react-redux"
import {
    selectSubtitleById,
    updateSubtitle
} from "@shared/redux/subtitleSlice"
import {
    selectSelectedIds
} from "@shared/redux/timelineSlice"
import Card from "./Card"
import Fieldset from "./Fieldset"

const TEXT_EFFECTS = [
    { id: "none", name: "None" },
    { id: "fade", name: "Fade" },
    { id: "typewriter", name: "Typewriter" },
    { id: "slide-up", name: "Slide Up" },
    { id: "slide-down", name: "Slide Down" },
    { id: "bounce", name: "Bounce" },
    { id: "scale", name: "Scale" },
]

export default function SubtitleSection() {
    const dispatch = useDispatch()

    const selectedIds = useSelector(selectSelectedIds)
    const config = useSelector(state => selectSubtitleById(state, selectedIds[0]))

    const onChange = e => dispatch(updateSubtitle({ id: config.id, changes: { text: e.target.value } }))

    const entranceEffect = config?.entranceEffect || { type: "none", duration: 300 }
    const exitEffect = config?.exitEffect || { type: "none", duration: 300 }

    const setEntranceType = useCallback(type => {
        if (!config) return
        dispatch(updateSubtitle({ id: config.id, changes: { entranceEffect: { ...entranceEffect, type } } }))
    }, [dispatch, config, entranceEffect])

    const setExitType = useCallback(type => {
        if (!config) return
        dispatch(updateSubtitle({ id: config.id, changes: { exitEffect: { ...exitEffect, type } } }))
    }, [dispatch, config, exitEffect])

    const setEntranceDuration = useCallback(duration => {
        if (!config) return
        dispatch(updateSubtitle({ id: config.id, changes: { entranceEffect: { ...entranceEffect, duration: Number(duration) } } }))
    }, [dispatch, config, entranceEffect])

    const setExitDuration = useCallback(duration => {
        if (!config) return
        dispatch(updateSubtitle({ id: config.id, changes: { exitEffect: { ...exitEffect, duration: Number(duration) } } }))
    }, [dispatch, config, exitEffect])

    return (
        <Card icon={<ChatBubbleOvalLeftIcon className="w-6 h-6" />} title="Subtitle Element" showClose={true}>
            <Fieldset legend="Content">
                <legend className="fieldset-label">Text</legend>
                <input value={config?.text || ""} onChange={onChange}
                    type="text" placeholder="Subtitle" required className={`input validator w-full`}
                    disabled={selectedIds.length !== 1} />
                <div className="validator-hint">Cannot be empty</div>
            </Fieldset>

            {selectedIds.length === 1 && config && (
                <Fieldset legend="Animations">
                    <div className="flex flex-col gap-3">
                        {/* Entrance */}
                        <div>
                            <span className="text-[10px] opacity-50 mb-1 block">Entrance</span>
                            <div className="grid grid-cols-4 gap-1">
                                {TEXT_EFFECTS.map(e => (
                                    <button key={e.id} onClick={() => setEntranceType(e.id)}
                                        className={`px-1 py-1 rounded text-[9px] font-medium transition-colors ${
                                            entranceEffect.type === e.id
                                                ? "bg-accent text-accent-content"
                                                : "bg-base-200 text-base-content/50 hover:text-base-content"
                                        }`}>
                                        {e.name}
                                    </button>
                                ))}
                            </div>
                            {entranceEffect.type !== "none" && (
                                <div className="mt-1.5 flex items-center gap-2">
                                    <span className="text-[9px] opacity-40 w-12">Duration</span>
                                    <input type="range" min="100" max="1500" step="50"
                                        value={entranceEffect.duration}
                                        onChange={e => setEntranceDuration(e.target.value)}
                                        className="range range-xs range-accent flex-1" />
                                    <span className="text-[9px] opacity-40 w-10 text-right">{entranceEffect.duration}ms</span>
                                </div>
                            )}
                        </div>

                        {/* Exit */}
                        <div>
                            <span className="text-[10px] opacity-50 mb-1 block">Exit</span>
                            <div className="grid grid-cols-4 gap-1">
                                {TEXT_EFFECTS.map(e => (
                                    <button key={e.id} onClick={() => setExitType(e.id)}
                                        className={`px-1 py-1 rounded text-[9px] font-medium transition-colors ${
                                            exitEffect.type === e.id
                                                ? "bg-accent text-accent-content"
                                                : "bg-base-200 text-base-content/50 hover:text-base-content"
                                        }`}>
                                        {e.name}
                                    </button>
                                ))}
                            </div>
                            {exitEffect.type !== "none" && (
                                <div className="mt-1.5 flex items-center gap-2">
                                    <span className="text-[9px] opacity-40 w-12">Duration</span>
                                    <input type="range" min="100" max="1500" step="50"
                                        value={exitEffect.duration}
                                        onChange={e => setExitDuration(e.target.value)}
                                        className="range range-xs range-accent flex-1" />
                                    <span className="text-[9px] opacity-40 w-10 text-right">{exitEffect.duration}ms</span>
                                </div>
                            )}
                        </div>
                    </div>
                </Fieldset>
            )}
        </Card>
    )
}