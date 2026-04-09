export default function TutorialWaiting({ onSkip }) {
    return (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[999]">
            <div className="bg-base-200 border border-base-content/10 rounded-xl shadow-xl px-5 py-3 flex items-center gap-3">
                {/* Pulsing recording dot */}
                <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-error opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-error" />
                </span>

                <div>
                    <p className="text-sm font-medium text-base-content/90">
                        Recording in progress...
                    </p>
                    <p className="text-xs text-base-content/50">
                        Stop when you're ready — we'll continue the tutorial after.
                    </p>
                </div>

                <button
                    className="btn btn-ghost btn-xs text-base-content/40 ml-2"
                    onClick={onSkip}
                >
                    Skip
                </button>
            </div>
        </div>
    )
}
