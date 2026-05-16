import { useCallback } from "react"
import { useDispatch, useSelector } from "react-redux"
import {
    AUDIO_TRACKS,
    CLIPS,
    MASKS,
    OVERLAY_TRACKS,
    SUBTITLES,
} from "@shared/helpers"
import { removeClip } from "@shared/redux/clipSlice"
import { removeSubtitle } from "@shared/redux/subtitleSlice"
import { removeAudioClip } from "@shared/redux/audioTrackSlice"
import { removeOverlay } from "@shared/redux/overlaySlice"
import { removeMask } from "@shared/redux/maskSlice"
import { selectIsPlaying } from "@shared/redux/editorSlice"
import {
    selectSelectedIds,
    selectSelectedRow,
    setSelectedIds,
} from "@shared/redux/timelineSlice"

export default function useDeleteSelection() {
    const dispatch = useDispatch()
    const selectedIds = useSelector(selectSelectedIds)
    const selectedRow = useSelector(selectSelectedRow)
    const isPlaying = useSelector(selectIsPlaying)
    const hasSelection = selectedIds.length > 0

    const isSupportedRow = (
        selectedRow === CLIPS ||
        selectedRow === SUBTITLES ||
        selectedRow === AUDIO_TRACKS ||
        selectedRow === OVERLAY_TRACKS ||
        selectedRow === MASKS
    )

    const handleDelete = useCallback(() => {
        if (!hasSelection || isPlaying) return
        selectedIds.forEach(id => {
            switch (selectedRow) {
                case CLIPS: dispatch(removeClip(id)); break
                case SUBTITLES: dispatch(removeSubtitle(id)); break
                case AUDIO_TRACKS: dispatch(removeAudioClip(id)); break
                case OVERLAY_TRACKS: dispatch(removeOverlay(id)); break
                case MASKS: dispatch(removeMask(id)); break
            }
        })
        dispatch(setSelectedIds([]))
    }, [dispatch, hasSelection, isPlaying, selectedIds, selectedRow])

    return { handleDelete, hasSelection, isPlaying, isSupportedRow }
}
