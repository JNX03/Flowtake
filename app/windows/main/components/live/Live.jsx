import PropTypes from "prop-types"
import { SignalIcon } from "@heroicons/react/24/outline"
import LiveStreamingSettings from "../settings/LiveStreamingSettings"

export default function Live({ isOpen }) {
    if (!isOpen) return null

    return (
        <div className="h-full flex flex-col gap-4 overflow-y-auto">
            <header className="flex items-center gap-2">
                <SignalIcon className="size-5 text-primary" />
                <h2 className="font-brand font-semibold text-base">Live Streaming</h2>
                <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[9px] font-bold uppercase tracking-wider">
                    Beta
                </span>
            </header>
            <p className="text-xs text-base-content/55 leading-relaxed -mt-2">
                Configure your destination and stream quality. To go live, open the recorder and switch the
                pill from <span className="font-semibold text-base-content/70">Rec</span> to <span className="font-semibold text-base-content/70">Live</span>.
            </p>
            <div className="rounded-2xl border border-base-content/5 bg-base-100/60 p-4">
                <LiveStreamingSettings />
            </div>
        </div>
    )
}

Live.propTypes = {
    isOpen: PropTypes.bool.isRequired,
}
