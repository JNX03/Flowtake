import PropTypes from "prop-types"
import { useCallback } from "react"
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
}) {
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
    })

    const onSelectAction = useCallback(() => {
        if (!isDragging) onSelect?.()
    }, [isDragging, onSelect])

    return (
        <Action anim={anim} anims={anims} start={start} duration={duration} onSelect={onSelectAction}
            onContextMenu={onContextMenu} isRowSelected={isRowSelected} isClickEnabled={!isDragging} color={color}
            isMinimized={isMinimized} isDragging={isDragging} actionRef={actionElementRef}>
            <div ref={leftResizeRef}
                title={isMinimized ? undefined : "Drag to trim start"}
                className={`w-6 ${isMinimized ? "" : "hover:bg-base-content/30 transition-colors cursor-col-resize"} shrink-0 flex items-center justify-center group/left z-10`}>
                {!isMinimized && (
                    <div className="w-1 h-5 rounded-full bg-base-content/50 group-hover/left:bg-base-content/90 group-hover/left:w-1.5 group-hover/left:h-7 transition-all shadow-sm" />
                )}
            </div>
            <div ref={moveHandleRef}
                title={isMinimized ? undefined : "Drag to move"}
                className={`flex-1 flex flex-col justify-evenly min-w-0 relative group/move ${isMinimized ? "" : "cursor-grab active:cursor-grabbing"}`}>
                {children}
                {!isMinimized && (
                    <div className="absolute top-1 left-1/2 -translate-x-1/2 opacity-30 group-hover/move:opacity-70 transition-opacity pointer-events-none">
                        <div className="flex flex-col gap-0.5">
                            <div className="w-4 h-px bg-current rounded-full" />
                            <div className="w-4 h-px bg-current rounded-full" />
                            <div className="w-4 h-px bg-current rounded-full" />
                        </div>
                    </div>
                )}
            </div>
            <div ref={rightResizeRef}
                title={isMinimized ? undefined : "Drag to trim end"}
                className={`w-6 ${isMinimized ? "" : "hover:bg-base-content/30 transition-colors cursor-col-resize"} shrink-0 flex items-center justify-center group/right z-10`}>
                {!isMinimized && (
                    <div className="w-1 h-5 rounded-full bg-base-content/50 group-hover/right:bg-base-content/90 group-hover/right:w-1.5 group-hover/right:h-7 transition-all shadow-sm" />
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
}
