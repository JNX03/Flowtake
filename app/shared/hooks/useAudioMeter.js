import { useEffect, useRef, useState } from "react"

/**
 * Real-time audio level metering from a MediaStream.
 * Returns { level, peak, isClipping } all normalized 0-1.
 */
export default function useAudioMeter(stream, enabled = true) {
    const [level, setLevel] = useState(0)
    const [peak, setPeak] = useState(0)

    const ctxRef = useRef(null)
    const sourceRef = useRef(null)
    const analyserRef = useRef(null)
    const rafRef = useRef(null)
    const smoothedRef = useRef(0)
    const peakRef = useRef(0)
    const peakDecayRef = useRef(0)

    useEffect(() => {
        if (!stream || !enabled) {
            smoothedRef.current = 0
            peakRef.current = 0
            setLevel(0)
            setPeak(0)
            return
        }

        const audioTracks = stream.getAudioTracks()
        if (audioTracks.length === 0) return

        let ctx
        try {
            ctx = new AudioContext()
        } catch {
            return
        }

        const analyser = ctx.createAnalyser()
        analyser.fftSize = 256
        analyser.smoothingTimeConstant = 0.3

        let source
        try {
            source = ctx.createMediaStreamSource(stream)
            source.connect(analyser)
        } catch {
            ctx.close().catch(() => {})
            return
        }

        ctxRef.current = ctx
        sourceRef.current = source
        analyserRef.current = analyser

        const dataArray = new Uint8Array(analyser.frequencyBinCount)

        const tick = () => {
            analyser.getByteFrequencyData(dataArray)

            // Compute RMS
            let sum = 0
            for (let i = 0; i < dataArray.length; i++) {
                const v = dataArray[i] / 255
                sum += v * v
            }
            const rms = Math.sqrt(sum / dataArray.length)

            // Exponential smoothing
            const raw = Math.min(rms * 1.8, 1) // slight boost for visual responsiveness
            smoothedRef.current = smoothedRef.current * 0.7 + raw * 0.3

            // Peak hold with slow decay
            if (smoothedRef.current > peakRef.current) {
                peakRef.current = smoothedRef.current
                peakDecayRef.current = 0
            } else {
                peakDecayRef.current++
                if (peakDecayRef.current > 30) { // ~0.5s at 60fps
                    peakRef.current = Math.max(0, peakRef.current - 0.02)
                }
            }

            setLevel(smoothedRef.current)
            setPeak(peakRef.current)

            rafRef.current = requestAnimationFrame(tick)
        }

        rafRef.current = requestAnimationFrame(tick)

        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current)
            try { source.disconnect() } catch { /* noop */ }
            ctx.close().catch(() => {})
            ctxRef.current = null
            sourceRef.current = null
            analyserRef.current = null
        }
    }, [stream, enabled])

    return { level, peak, isClipping: level > 0.95 }
}
