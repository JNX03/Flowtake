import PropTypes from "prop-types"
import {
    useEffect,
    useRef
} from "react"

export default function AudioWaveform({ waveformData, width, height = 24, color = "oklch(var(--s))" }) {

    const canvasRef = useRef(null)

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas || !waveformData?.length || !width) return

        const ctx = canvas.getContext("2d")
        const dpr = window.devicePixelRatio || 1
        canvas.width = width * dpr
        canvas.height = height * dpr
        ctx.scale(dpr, dpr)
        ctx.clearRect(0, 0, width, height)

        const barWidth = width / waveformData.length
        const centerY = height / 2

        ctx.fillStyle = color
        ctx.globalAlpha = 0.4

        for (let i = 0; i < waveformData.length; i++) {
            const amplitude = waveformData[i] * centerY
            const x = i * barWidth
            const barH = Math.max(amplitude, 1)
            ctx.fillRect(x, centerY - barH, Math.max(barWidth - 0.5, 0.5), barH * 2)
        }
    }, [waveformData, width, height, color])

    if (!waveformData?.length) return null

    return (
        <canvas
            ref={canvasRef}
            className="absolute inset-0 pointer-events-none"
            style={{ width: `${width}px`, height: `${height}px` }}
        />
    )
}

AudioWaveform.propTypes = {
    waveformData: PropTypes.arrayOf(PropTypes.number),
    width: PropTypes.number.isRequired,
    height: PropTypes.number,
    color: PropTypes.string,
}
