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
                className={`w-3.5 ${isMinimized ? "" : "hover:bg-base-content/40 transition-colors cursor-ew-resize"} shrink-0 flex items-center justify-center`}>
                {!isMinimized && <div className="w-0.5 h-3 rounded-full bg-base-content/20" />}
            </div>
            <div ref={moveHandleRef} className={`flex-1 flex flex-col justify-evenly min-w-0 ${isMinimized ? "" : "cursor-grab"}`}>
                {children}
            </div>
            <div ref={rightResizeRef}
                className={`w-3.5 ${isMinimized ? "" : "hover:bg-base-content/40 transition-colors cursor-ew-resize"} shrink-0 flex items-center justify-center`}>
                {!isMinimized && <div className="w-0.5 h-3 rounded-full bg-base-content/20" />}
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
