import PropTypes from "prop-types"

const getColor = (level) => {
    if (level > 0.9) return "bg-red-500"
    if (level > 0.7) return "bg-amber-400"
    return "bg-emerald-500"
}

const getBarColor = (level, threshold) => {
    if (level < threshold) return "bg-white/[0.06]"
    if (threshold > 0.7) return "bg-red-500"
    if (threshold > 0.4) return "bg-amber-400"
    return "bg-emerald-500"
}

/** Compact 3-bar signal indicator for tight spaces (recorder pill) */
function CompactMeter({ level }) {
    return (
        <div className="flex items-end gap-[2px] h-3 flex-shrink-0">
            <div className={`w-[3px] rounded-full transition-colors duration-75 h-[5px] ${getBarColor(level, 0.05)}`} />
            <div className={`w-[3px] rounded-full transition-colors duration-75 h-[8px] ${getBarColor(level, 0.35)}`} />
            <div className={`w-[3px] rounded-full transition-colors duration-75 h-[11px] ${getBarColor(level, 0.7)}`} />
        </div>
    )
}

/** Horizontal bar meter for wider spaces */
function BarMeter({ level, peak, showPeak }) {
    return (
        <div className="relative w-full h-1 bg-base-content/5 rounded-full overflow-hidden">
            <div
                className={`absolute inset-y-0 left-0 rounded-full transition-all duration-75 ${getColor(level)}`}
                style={{ width: `${Math.max(level * 100, 0)}%` }}
            />
            {showPeak && peak > 0.01 && (
                <div
                    className={`absolute inset-y-0 w-[2px] rounded-full transition-all duration-150 ${getColor(peak)}`}
                    style={{ left: `${Math.min(peak * 100, 99)}%`, opacity: 0.6 }}
                />
            )}
        </div>
    )
}

export default function VolumeMeter({ level = 0, peak = 0, compact = false, showPeak = false }) {
    if (compact) return <CompactMeter level={level} />
    return <BarMeter level={level} peak={peak} showPeak={showPeak} />
}

VolumeMeter.propTypes = {
    level: PropTypes.number,
    peak: PropTypes.number,
    compact: PropTypes.bool,
    showPeak: PropTypes.bool,
}
