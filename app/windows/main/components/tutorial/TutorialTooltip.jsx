import { useMemo } from "react"
import { TUTORIAL_STEPS } from "./steps"

const ARROW_SIZE = 8
const GAP = 12

const OPPOSITE = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' }

function placeFor(rect, padding, placement, tooltipWidth, tooltipHeight) {
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const out = {}
    switch (placement) {
        case 'top':
            out.left = cx - tooltipWidth / 2
            out.top = rect.top - padding - GAP - tooltipHeight
            break
        case 'bottom':
            out.left = cx - tooltipWidth / 2
            out.top = rect.top + rect.height + padding + GAP
            break
        case 'left':
            out.left = rect.left - padding - GAP - tooltipWidth
            out.top = cy - tooltipHeight / 2
            break
        case 'right':
            out.left = rect.left + rect.width + padding + GAP
            out.top = cy - tooltipHeight / 2
            break
        default:
            out.left = cx - tooltipWidth / 2
            out.top = rect.top + rect.height + padding + GAP
    }
    return out
}

function fitsInViewport(pos, tooltipWidth, tooltipHeight) {
    return pos.left >= 16 &&
        pos.top >= 16 &&
        pos.left + tooltipWidth <= window.innerWidth - 16 &&
        pos.top + tooltipHeight <= window.innerHeight - 16
}

function overlapsRect(pos, tooltipWidth, tooltipHeight, rect, padding) {
    const r1 = { l: pos.left, t: pos.top, r: pos.left + tooltipWidth, b: pos.top + tooltipHeight }
    const r2 = {
        l: rect.left - padding,
        t: rect.top - padding,
        r: rect.left + rect.width + padding,
        b: rect.top + rect.height + padding,
    }
    return !(r1.r <= r2.l || r1.l >= r2.r || r1.b <= r2.t || r1.t >= r2.b)
}

function getPosition(rect, padding, placement, tooltipWidth, tooltipHeight) {
    if (!rect) return { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }

    // Try requested placement first; if it doesn't fit or overlaps the spotlight after clamping, flip.
    let chosen = placement || 'bottom'
    let pos = placeFor(rect, padding, chosen, tooltipWidth, tooltipHeight)

    if (!fitsInViewport(pos, tooltipWidth, tooltipHeight)) {
        const flipped = OPPOSITE[chosen]
        if (flipped) {
            const alt = placeFor(rect, padding, flipped, tooltipWidth, tooltipHeight)
            if (fitsInViewport(alt, tooltipWidth, tooltipHeight)) {
                chosen = flipped
                pos = alt
            }
        }
    }

    // Clamp to viewport
    pos.left = Math.max(16, Math.min(pos.left, window.innerWidth - tooltipWidth - 16))
    pos.top = Math.max(16, Math.min(pos.top, window.innerHeight - tooltipHeight - 16))

    // If clamping pushed the tooltip on top of the spotlight, flip and try again.
    if (overlapsRect(pos, tooltipWidth, tooltipHeight, rect, padding)) {
        const flipped = OPPOSITE[chosen]
        if (flipped) {
            const alt = placeFor(rect, padding, flipped, tooltipWidth, tooltipHeight)
            alt.left = Math.max(16, Math.min(alt.left, window.innerWidth - tooltipWidth - 16))
            alt.top = Math.max(16, Math.min(alt.top, window.innerHeight - tooltipHeight - 16))
            if (!overlapsRect(alt, tooltipWidth, tooltipHeight, rect, padding)) {
                chosen = flipped
                pos = alt
            }
        }
    }

    return { position: 'fixed', left: pos.left, top: pos.top, _placement: chosen }
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
    const effectivePlacement = posStyle._placement || placement
    const { _placement: _p, ...renderStyle } = posStyle

    return (
        <div
            className="fixed z-[999] animate-in fade-in duration-200"
            style={{ ...renderStyle, width: tooltipWidth }}
        >
            {/* Arrow */}
            {rect && effectivePlacement && <div style={getArrowStyle(effectivePlacement)} />}

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
