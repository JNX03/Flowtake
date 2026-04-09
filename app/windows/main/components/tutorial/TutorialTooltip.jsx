import { useMemo } from "react"
import { TUTORIAL_STEPS } from "./steps"

const ARROW_SIZE = 8
const GAP = 12

function getPosition(rect, padding, placement, tooltipWidth, tooltipHeight) {
    if (!rect) return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }

    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const style = { position: 'fixed' }

    switch (placement) {
        case 'top':
            style.left = cx - tooltipWidth / 2
            style.top = rect.top - padding - GAP - tooltipHeight
            break
        case 'bottom':
            style.left = cx - tooltipWidth / 2
            style.top = rect.top + rect.height + padding + GAP
            break
        case 'left':
            style.left = rect.left - padding - GAP - tooltipWidth
            style.top = cy - tooltipHeight / 2
            break
        case 'right':
            style.left = rect.left + rect.width + padding + GAP
            style.top = cy - tooltipHeight / 2
            break
        default:
            style.left = cx - tooltipWidth / 2
            style.top = rect.top + rect.height + padding + GAP
    }

    // Clamp to viewport
    style.left = Math.max(16, Math.min(style.left, window.innerWidth - tooltipWidth - 16))
    style.top = Math.max(16, Math.min(style.top, window.innerHeight - tooltipHeight - 16))

    return style
}

function getArrowStyle(placement) {
    const base = { position: 'absolute', width: 0, height: 0 }
    const s = ARROW_SIZE

    switch (placement) {
        case 'top':
            return { ...base, bottom: -s, left: '50%', transform: 'translateX(-50%)',
                borderLeft: `${s}px solid transparent`, borderRight: `${s}px solid transparent`,
                borderTop: `${s}px solid oklch(var(--b2))` }
        case 'bottom':
            return { ...base, top: -s, left: '50%', transform: 'translateX(-50%)',
                borderLeft: `${s}px solid transparent`, borderRight: `${s}px solid transparent`,
                borderBottom: `${s}px solid oklch(var(--b2))` }
        case 'left':
            return { ...base, right: -s, top: '50%', transform: 'translateY(-50%)',
                borderTop: `${s}px solid transparent`, borderBottom: `${s}px solid transparent`,
                borderLeft: `${s}px solid oklch(var(--b2))` }
        case 'right':
            return { ...base, left: -s, top: '50%', transform: 'translateY(-50%)',
                borderTop: `${s}px solid transparent`, borderBottom: `${s}px solid transparent`,
                borderRight: `${s}px solid oklch(var(--b2))` }
        default:
            return base
    }
}

export default function TutorialTooltip({ stepIndex, rect, padding, placement, onSkip, onNext }) {
    const step = TUTORIAL_STEPS[stepIndex]
    const totalSteps = TUTORIAL_STEPS.length
    const tooltipWidth = 300
    const tooltipHeight = 160

    const posStyle = useMemo(
        () => getPosition(rect, padding, placement, tooltipWidth, tooltipHeight),
        [rect, padding, placement]
    )

    return (
        <div
            className="fixed z-[999] animate-in fade-in duration-200"
            style={{ ...posStyle, width: tooltipWidth }}
        >
            {/* Arrow */}
            {rect && placement && <div style={getArrowStyle(placement)} />}

            <div className="bg-base-200 border border-base-content/10 rounded-xl shadow-xl p-4">
                {/* Step dots */}
                <div className="flex gap-1.5 mb-3">
                    {TUTORIAL_STEPS.map((_, i) => (
                        <div
                            key={i}
                            className={`w-2 h-2 rounded-full transition-colors ${
                                i === stepIndex ? 'bg-primary' :
                                i < stepIndex ? 'bg-primary/40' : 'bg-base-content/20'
                            }`}
                        />
                    ))}
                </div>

                {/* Content */}
                <h3 className="text-sm font-semibold text-base-content/90 mb-1">
                    {step.title}
                </h3>
                <p className="text-xs text-base-content/60 leading-relaxed mb-4">
                    {step.description}
                </p>

                {/* Footer */}
                <div className="flex items-center justify-between">
                    <button
                        className="btn btn-ghost btn-xs text-base-content/40"
                        onClick={onSkip}
                    >
                        Skip tutorial
                    </button>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-base-content/30">
                            {stepIndex + 1} / {totalSteps}
                        </span>
                        <button
                            className="btn btn-primary btn-xs"
                            onClick={onNext}
                        >
                            {step.isFinal ? 'Finish' : 'Next'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
