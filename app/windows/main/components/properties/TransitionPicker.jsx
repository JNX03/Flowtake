import PropTypes from "prop-types"
import { useCallback } from "react"
import {
    useDispatch,
    useSelector
} from "react-redux"
import {
    selectClipById,
    updateClip
} from "@shared/redux/clipSlice"
import { selectSelectedIds } from "@shared/redux/timelineSlice"
import { TRANSITION_TYPES } from "@shared/scene/transition/transitions"

export default function TransitionPicker() {
    const dispatch = useDispatch()
    const selectedIds = useSelector(selectSelectedIds)
    const clipId = selectedIds[0]
    const clip = useSelector(state => clipId ? selectClipById(state, clipId) : null)

    const transitionIn = clip?.transitionIn || { type: "none", duration: 500 }
    const transitionOut = clip?.transitionOut || { type: "none", duration: 500 }

    const setTransitionIn = useCallback((type) => {
        if (!clipId) return
        dispatch(updateClip({ id: clipId, changes: { transitionIn: { ...transitionIn, type } } }))
    }, [dispatch, clipId, transitionIn])

    const setTransitionOut = useCallback((type) => {
        if (!clipId) return
        dispatch(updateClip({ id: clipId, changes: { transitionOut: { ...transitionOut, type } } }))
    }, [dispatch, clipId, transitionOut])

    const setTransitionInDuration = useCallback((duration) => {
        if (!clipId) return
        dispatch(updateClip({ id: clipId, changes: { transitionIn: { ...transitionIn, duration: Number(duration) } } }))
    }, [dispatch, clipId, transitionIn])

    const setTransitionOutDuration = useCallback((duration) => {
        if (!clipId) return
        dispatch(updateClip({ id: clipId, changes: { transitionOut: { ...transitionOut, duration: Number(duration) } } }))
    }, [dispatch, clipId, transitionOut])

    if (!clip) return null

    return (
        <div className="flex flex-col gap-3">
            {/* Transition In */}
            <div>
                <span className="text-[11px] font-medium uppercase tracking-wider opacity-40 mb-1.5 block">
                    Transition In
                </span>
                <div className="grid grid-cols-3 gap-1">
                    {TRANSITION_TYPES.map(t => (
                        <button key={t.id}
                            onClick={() => setTransitionIn(t.id)}
                            className={`px-2 py-1.5 rounded text-[10px] font-medium transition-colors ${
                                transitionIn.type === t.id
                                    ? "bg-primary text-primary-content"
                                    : "bg-base-200 text-base-content/60 hover:text-base-content hover:bg-base-200/80"
                            }`}>
                            {t.name}
                        </button>
                    ))}
                </div>
                {transitionIn.type !== "none" && (
                    <div className="mt-2 flex items-center gap-2">
                        <span className="text-[10px] opacity-50 w-14">Duration</span>
                        <input type="range" min="100" max="2000" step="100"
                            value={transitionIn.duration}
                            onChange={e => setTransitionInDuration(e.target.value)}
                            className="range range-xs range-primary flex-1" />
                        <span className="text-[10px] opacity-50 w-10 text-right">{transitionIn.duration}ms</span>
                    </div>
                )}
            </div>

            {/* Transition Out */}
            <div>
                <span className="text-[11px] font-medium uppercase tracking-wider opacity-40 mb-1.5 block">
                    Transition Out
                </span>
                <div className="grid grid-cols-3 gap-1">
                    {TRANSITION_TYPES.map(t => (
                        <button key={t.id}
                            onClick={() => setTransitionOut(t.id)}
                            className={`px-2 py-1.5 rounded text-[10px] font-medium transition-colors ${
                                transitionOut.type === t.id
                                    ? "bg-primary text-primary-content"
                                    : "bg-base-200 text-base-content/60 hover:text-base-content hover:bg-base-200/80"
                            }`}>
                            {t.name}
                        </button>
                    ))}
                </div>
                {transitionOut.type !== "none" && (
                    <div className="mt-2 flex items-center gap-2">
                        <span className="text-[10px] opacity-50 w-14">Duration</span>
                        <input type="range" min="100" max="2000" step="100"
                            value={transitionOut.duration}
                            onChange={e => setTransitionOutDuration(e.target.value)}
                            className="range range-xs range-primary flex-1" />
                        <span className="text-[10px] opacity-50 w-10 text-right">{transitionOut.duration}ms</span>
                    </div>
                )}
            </div>
        </div>
    )
}
