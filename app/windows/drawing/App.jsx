import { useCallback, useEffect, useRef, useState } from "react"

const COLORS = [
    { name: "Red", value: "#ef4444" },
    { name: "Blue", value: "#3b82f6" },
    { name: "Green", value: "#22c55e" },
    { name: "Yellow", value: "#eab308" },
    { name: "White", value: "#ffffff" },
]

const PEN_SIZES = [
    { name: "Thin", value: 2 },
    { name: "Medium", value: 4 },
    { name: "Thick", value: 8 },
]

export default function App() {
    const canvasRef = useRef(null)
    const [isDrawing, setIsDrawing] = useState(false)
    const [color, setColor] = useState("#ef4444")
    const [penSize, setPenSize] = useState(4)
    const [isEraser, setIsEraser] = useState(false)
    const [showToolbar, setShowToolbar] = useState(true)
    const lastPoint = useRef(null)

    // Resize canvas to fill window
    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const resize = () => {
            canvas.width = window.innerWidth
            canvas.height = window.innerHeight
        }
        resize()
        window.addEventListener("resize", resize)
        return () => window.removeEventListener("resize", resize)
    }, [])

    const getPos = (e) => ({ x: e.clientX, y: e.clientY })

    const startDraw = useCallback((e) => {
        setIsDrawing(true)
        lastPoint.current = getPos(e)
    }, [])

    const draw = useCallback((e) => {
        if (!isDrawing) return
        const canvas = canvasRef.current
        const ctx = canvas.getContext("2d")
        const pos = getPos(e)

        ctx.beginPath()
        ctx.moveTo(lastPoint.current.x, lastPoint.current.y)
        ctx.lineTo(pos.x, pos.y)
        ctx.strokeStyle = isEraser ? "rgba(0,0,0,1)" : color
        ctx.globalCompositeOperation = isEraser ? "destination-out" : "source-over"
        ctx.lineWidth = isEraser ? penSize * 4 : penSize
        ctx.lineCap = "round"
        ctx.lineJoin = "round"
        ctx.stroke()

        lastPoint.current = pos
    }, [isDrawing, color, penSize, isEraser])

    const stopDraw = useCallback(() => {
        setIsDrawing(false)
        lastPoint.current = null
    }, [])

    const clearCanvas = () => {
        const canvas = canvasRef.current
        const ctx = canvas.getContext("2d")
        ctx.clearRect(0, 0, canvas.width, canvas.height)
    }

    const closeOverlay = () => {
        window.electron.ipcRenderer.invoke("toggle-drawing-overlay")
    }

    // Keyboard shortcuts
    useEffect(() => {
        const handleKey = (e) => {
            if (e.key === "Escape") closeOverlay()
            if (e.key === "c" && !e.ctrlKey) clearCanvas()
            if (e.key === "e") setIsEraser(prev => !prev)
            if (e.key === "t") setShowToolbar(prev => !prev)
        }
        window.addEventListener("keydown", handleKey)
        return () => window.removeEventListener("keydown", handleKey)
    }, [])

    return (
        <div className="h-full w-full relative" style={{ background: "transparent" }}>
            <style>{`
                html, body { background: transparent !important; cursor: crosshair; }
                .toolbar-pill {
                    background: rgba(10, 10, 22, 0.92);
                    backdrop-filter: blur(20px);
                    -webkit-backdrop-filter: blur(20px);
                    box-shadow: 0 4px 24px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06) inset;
                }
            `}</style>

            {/* Drawing canvas — fullscreen transparent */}
            <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full"
                style={{ background: "transparent" }}
                onMouseDown={startDraw}
                onMouseMove={draw}
                onMouseUp={stopDraw}
                onMouseLeave={stopDraw}
            />

            {/* Floating toolbar at bottom center */}
            {showToolbar && (
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 toolbar-pill rounded-2xl px-3 py-2 flex items-center gap-2">
                    {/* Colors */}
                    <div className="flex items-center gap-1">
                        {COLORS.map(c => (
                            <button
                                key={c.value}
                                title={c.name}
                                onClick={() => { setColor(c.value); setIsEraser(false) }}
                                className={`w-5 h-5 rounded-full border-2 transition-all cursor-pointer ${
                                    color === c.value && !isEraser
                                        ? "border-white scale-110"
                                        : "border-white/20 hover:border-white/40"
                                }`}
                                style={{ background: c.value }}
                            />
                        ))}
                    </div>

                    <div className="w-px h-5 bg-white/10" />

                    {/* Pen sizes */}
                    <div className="flex items-center gap-1">
                        {PEN_SIZES.map(s => (
                            <button
                                key={s.value}
                                title={s.name}
                                onClick={() => setPenSize(s.value)}
                                className={`w-6 h-6 rounded-md flex items-center justify-center transition-all cursor-pointer ${
                                    penSize === s.value && !isEraser
                                        ? "bg-white/15 text-white"
                                        : "text-white/40 hover:text-white/60 hover:bg-white/5"
                                }`}
                            >
                                <div
                                    className="rounded-full bg-current"
                                    style={{ width: s.value + 2, height: s.value + 2 }}
                                />
                            </button>
                        ))}
                    </div>

                    <div className="w-px h-5 bg-white/10" />

                    {/* Eraser */}
                    <button
                        title="Eraser (E)"
                        onClick={() => setIsEraser(prev => !prev)}
                        className={`w-7 h-7 rounded-md flex items-center justify-center text-[11px] font-medium transition-all cursor-pointer ${
                            isEraser
                                ? "bg-indigo-500/20 text-indigo-300"
                                : "text-white/40 hover:text-white/60 hover:bg-white/5"
                        }`}
                    >
                        <svg className="size-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6L12 17.25 20.25 6" />
                        </svg>
                    </button>

                    {/* Clear */}
                    <button
                        title="Clear all (C)"
                        onClick={clearCanvas}
                        className="w-7 h-7 rounded-md flex items-center justify-center text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer"
                    >
                        <svg className="size-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                        </svg>
                    </button>

                    <div className="w-px h-5 bg-white/10" />

                    {/* Close */}
                    <button
                        title="Close (Esc)"
                        onClick={closeOverlay}
                        className="w-7 h-7 rounded-md flex items-center justify-center text-white/40 hover:text-white/70 hover:bg-white/10 transition-all cursor-pointer"
                    >
                        <svg className="size-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            )}
        </div>
    )
}
