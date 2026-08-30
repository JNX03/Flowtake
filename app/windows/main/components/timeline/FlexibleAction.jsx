import PropTypes from "prop-types"
import { useCallback } from "react"
import { useSelector } from "react-redux"
import {
    selectIsPlaying,
} from "@shared/redux/editorSlice"
import Action from "./Action"
import useDragInteraction from "./useDragInteraction"

export default function FlexibleAction({
    anim,
    anims,
    isRowSelected,
    color,
    children,
    onChange,
    onSelect,
    onContextMenu,
    isMinimized = false,
    crossTrackEnabled = false,
    currentTrackId = null,
    trackDropZone = null,
    getTrackAnims = null,
    onTrackChange = null,
    disabled = false,
}) {
    const isPlaying = useSelector(selectIsPlaying)
    const isEditingDisabled = disabled || isPlaying
    const {
        moveHandleRef,
        leftResizeRef,
        rightResizeRef,
        actionElementRef,
        isDragging,
        start,
        duration,
    } = useDragInteraction({
        anim,
        anims,
        isMinimized,
        onChange,
        crossTrackEnabled,
        currentTrackId,
        trackDropZone,
        getTrackAnims,
        onTrackChange,
        color,
        disabled: isEditingDisabled,
    })

    const onSelectAction = useCallback(() => {
        if (!isDragging) onSelect?.()
    }, [isDragging, onSelect])

    return (
        <Action anim={anim} anims={anims} start={start} duration={duration} onSelect={onSelectAction}
            onContextMenu={onContextMenu} isRowSelected={isRowSelected} isClickEnabled={!isDragging} color={color}
            isMinimized={isMinimized} isDragging={isDragging}
            isDragEnabled={!isEditingDisabled} actionRef={actionElementRef}>
            <div ref={leftResizeRef}
                title={isMinimized ? undefined : isEditingDisabled ? "Editing is disabled" : "Drag to trim start"}
                className={`w-3 ${isMinimized ? "" : isEditingDisabled
                    ? "cursor-not-allowed opacity-35"
                    : "cursor-col-resize opacity-0 transition-opacity group-hover/timeline-item:opacity-100 group-focus-within/timeline-item:opacity-100"} shrink-0 flex items-center justify-center group/left z-10`}>
                {!isMinimized && (
                    <div className="h-5 w-0.5 rounded-full bg-base-content/65 group-hover/left:bg-base-content" />
                )}
            </div>
            <div ref={moveHandleRef}
                title={isMinimized ? undefined : isEditingDisabled ? "Editing is disabled" : "Drag to move"}
                className={`flex-1 flex flex-col justify-evenly min-w-0 relative group/move ${isMinimized
                    ? ""
                    : isEditingDisabled
                        ? "cursor-not-allowed"
                        : "cursor-grab active:cursor-grabbing"}`}>
                {children}
            </div>
            <div ref={rightResizeRef}
                title={isMinimized ? undefined : isEditingDisabled ? "Editing is disabled" : "Drag to trim end"}
                className={`w-3 ${isMinimized ? "" : isEditingDisabled
                    ? "cursor-not-allowed opacity-35"
                    : "cursor-col-resize opacity-0 transition-opacity group-hover/timeline-item:opacity-100 group-focus-within/timeline-item:opacity-100"} shrink-0 flex items-center justify-center group/right z-10`}>
                {!isMinimized && (
                    <div className="h-5 w-0.5 rounded-full bg-base-content/65 group-hover/right:bg-base-content" />
                )}
            </div>
        </Action>
    )
}

FlexibleAction.propTypes = {
    anim: PropTypes.shape({
        start: PropTypes.number.isRequired,
        end: PropTypes.number.isRequired
    }).isRequired,
    anims: PropTypes.arrayOf(PropTypes.shape({
        start: PropTypes.number.isRequired,
        end: PropTypes.number.isRequired
    })).isRequired,
    isRowSelected: PropTypes.bool.isRequired,
    color: PropTypes.oneOf(["primary", "secondary", "tertiary", "accent", "neutral"]),
    children: PropTypes.node,
    onChange: PropTypes.func.isRequired,
    onSelect: PropTypes.func,
    onContextMenu: PropTypes.func,
    isMinimized: PropTypes.bool,
    crossTrackEnabled: PropTypes.bool,
    currentTrackId: PropTypes.number,
    trackDropZone: PropTypes.string,
    getTrackAnims: PropTypes.func,
    onTrackChange: PropTypes.func,
    disabled: PropTypes.bool,
}
