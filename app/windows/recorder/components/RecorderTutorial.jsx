import { useCallback, useEffect, useRef, useState } from "react"
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow"
import { LogicalSize } from "@tauri-apps/api/window"

const TOUR = [
    {
        id: "rec-draw",
        title: "Draw on screen",
        body: "Annotate live while recording. Press E for eraser, C to clear, Esc to close.",
    },
    {
        id: "rec-teleprompter",
        title: "Teleprompter notes",
        body: "Open a notes overlay so you can read while recording.",
    },
    {
        id: "rec-screenshot",
        title: "Screenshot",
        body: "Capture a still frame at any moment during the recording.",
    },
    {
        id: "rec-pause",
        title: "Pause and resume",
        body: "Take a break — your recording stays seamless.",
    },
    {
        id: "rec-stop",
        title: "Stop and edit",
        body: "Click here when you're done. We'll open the editor next.",
    },
]

const PILL_AREA_HEIGHT = 72
const EXPANDED_WINDOW_W = 460
const EXPANDED_WINDOW_H = 260

export default function RecorderTutorial({ onActiveChange }) {
    const [active, setActive] = useState(false)
    const [stepIndex, setStepIndex] = useState(0)
    const [rect, setRect] = useState(null)
    const originalSizeRef = useRef(null)

    // Decide whether to show the tour: only when both flags say it's not yet completed.
    useEffect(() => {
        let cancelled = false
        const check = async () => {
            try {
                const ipc = window.electron.ipcRenderer
                const [main, rec] = await Promise.all([
                    ipc.invoke("store-get", "hasCompletedTutorial"),
                    ipc.invoke("store-get", "hasCompletedRecorderTutorial"),
                ])
                if (cancelled) return
                if (!main && !rec) {
                    setActive(true)
                }
            } catch { /* ignore */ }
        }
        check()
        return () => { cancelled = true }
    }, [])

    // Notify parent so it can keep the pill expanded while the tour runs.
    useEffect(() => {
        if (onActiveChange) onActiveChange(active)
    }, [active, onActiveChange])

    // Resize window taller for the tour, restore on exit.
    useEffect(() => {
        if (!active) return
        let restored = false
        const win = getCurrentWebviewWindow()
        ;(async () => {
            try {
                const size = await win.outerSize()
                const scale = await win.scaleFactor()
                originalSizeRef.current = {
                    width: Math.round(size.width / scale),
                    height: Math.round(size.height / scale),
                }
                await win.setSize(new LogicalSize(EXPANDED_WINDOW_W, EXPANDED_WINDOW_H))
            } catch { /* best-effort */ }
        })()
        return () => {
            if (restored) return
            restored = true
            ;(async () => {
                try {
                    const orig = originalSizeRef.current
                    if (orig) {
                        await win.setSize(new LogicalSize(orig.width, orig.height))
                    }
                } catch { /* best-effort */ }
            })()
        }
    }, [active])

    // Track the current target's bounding box (the pill mounts the targets with data-tutorial).
    useEffect(() => {
        if (!active) return
        const step = TOUR[stepIndex]
        if (!step) return

        const update = () => {
            const el = document.querySelector(`[data-tutorial="${step.id}"]`)
            if (el) {
                const r = el.getBoundingClientRect()
                setRect({ left: r.left, top: r.top, width: r.width, height: r.height })
            } else {
                setRect(null)
            }
        }

        update()
        const ro = new ResizeObserver(update)
        const target = document.querySelector(`[data-tutorial="${step.id}"]`)
        if (target) ro.observe(target)
        const mo = new MutationObserver(update)
        mo.observe(document.body, { childList: true, subtree: true })
        const onResize = () => update()
        window.addEventListener("resize", onResize)

        // Re-poll a few times in case the pill is mid-expand
        const poll = setInterval(update, 250)

        return () => {
            ro.disconnect()
            mo.disconnect()
            window.removeEventListener("resize", onResize)
            clearInterval(poll)
        }
    }, [active, stepIndex])

    const finish = useCallback(async () => {
        try {
            await window.electron.ipcRenderer.invoke("store-set", "hasCompletedRecorderTutorial", true)
        } catch { /* ignore */ }
        setActive(false)
    }, [])

    const onNext = useCallback(() => {
        if (stepIndex >= TOUR.length - 1) {
            finish()
        } else {
            setStepIndex(i => i + 1)
        }
    }, [stepIndex, finish])

    const onSkip = useCallback(() => { finish() }, [finish])

    if (!active) return null
    const step = TOUR[stepIndex]
    if (!step) return null

    // Tooltip sits in the area BELOW the pill (we resized the window for this).
    const tooltipTop = PILL_AREA_HEIGHT + 12
    const arrowLeft = rect ? rect.left + rect.width / 2 : window.innerWidth / 2

    return (
        <div className="fixed inset-0 z-[1000]" style={{ pointerEvents: "none" }}>
            {/* Spotlight ring around the highlighted button */}
            {rect && (
                <div
                    className="absolute rounded-lg"
                    style={{
                        top: rect.top - 4,
                        left: rect.left - 4,
                        width: rect.width + 8,
                        height: rect.height + 8,
                        boxShadow: "0 0 0 2px rgba(99,102,241,0.7), 0 0 0 6px rgba(99,102,241,0.18)",
                        pointerEvents: "none",
                    }}
                />
            )}

            {/* Tooltip card */}
            <div
                className="absolute left-1/2 -translate-x-1/2"
                style={{
                    top: tooltipTop,
                    width: 380,
                    pointerEvents: "auto",
                }}
            >
                {/* Arrow */}
                <div
                    className="absolute"
                    style={{
                        top: -6,
                        left: Math.max(16, Math.min(arrowLeft - (window.innerWidth / 2 - 190), 380 - 16)),
                        width: 0,
                        height: 0,
                        borderLeft: "6px solid transparent",
                        borderRight: "6px solid transparent",
                        borderBottom: "6px solid rgba(20, 20, 36, 0.96)",
                    }}
                />
                <div
                    style={{
                        background: "rgba(20, 20, 36, 0.96)",
                        backdropFilter: "blur(20px) saturate(1.4)",
                        WebkitBackdropFilter: "blur(20px) saturate(1.4)",
                        border: "1px solid rgba(255,255,255,0.06)",
                        boxShadow: "0 8px 32px rgba(0,0,0,0.55)",
                        borderRadius: 14,
                        padding: 14,
                        color: "white",
                    }}
                >
                    {/* dots */}
                    <div className="flex gap-1.5 mb-2">
                        {TOUR.map((_, i) => (
                            <div
                                key={i}
                                className="w-1.5 h-1.5 rounded-full"
                                style={{
                                    background:
                                        i === stepIndex ? "rgb(129,140,248)" :
                                        i < stepIndex ? "rgba(129,140,248,0.4)" :
                                        "rgba(255,255,255,0.18)",
                                }}
                            />
                        ))}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{step.title}</div>
                    <div style={{ fontSize: 12, lineHeight: 1.5, color: "rgba(255,255,255,0.65)", marginBottom: 12 }}>
                        {step.body}
                    </div>
                    <div className="flex items-center justify-between">
                        <button
                            onClick={onSkip}
                            style={{
                                fontSize: 11,
                                color: "rgba(255,255,255,0.4)",
                                background: "transparent",
                                border: "none",
                                cursor: "pointer",
                                padding: "4px 8px",
                            }}
                        >
                            Skip
                        </button>
                        <div className="flex items-center gap-2">
                            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
                                {stepIndex + 1} / {TOUR.length}
                            </span>
                            <button
                                onClick={onNext}
                                style={{
                                    fontSize: 11,
                                    fontWeight: 600,
                                    color: "white",
                                    background: "rgb(99,102,241)",
                                    border: "none",
                                    borderRadius: 8,
                                    padding: "5px 12px",
                                    cursor: "pointer",
                                }}
                            >
                                {stepIndex === TOUR.length - 1 ? "Got it" : "Next"}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
