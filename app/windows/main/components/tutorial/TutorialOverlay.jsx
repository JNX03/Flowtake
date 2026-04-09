import { useEffect, useRef, useState, useCallback } from "react"

export default function TutorialOverlay({ targetSelector, children }) {
    const [rect, setRect] = useState(null)
    const rafRef = useRef(null)
    const observerRef = useRef(null)

    const updateRect = useCallback(() => {
        if (!targetSelector) {
            setRect(null)
            return
        }
        const el = document.querySelector(targetSelector)
        if (el) {
            const r = el.getBoundingClientRect()
            setRect({ top: r.top, left: r.left, width: r.width, height: r.height })
        } else {
            setRect(null)
        }
    }, [targetSelector])

    useEffect(() => {
        if (!targetSelector) {
            setRect(null)
            return
        }

        updateRect()

        // Track position changes
        const el = document.querySelector(targetSelector)
        if (el) {
            observerRef.current = new ResizeObserver(updateRect)
            observerRef.current.observe(el)
        }

        // Also track on scroll/resize
        const onLayout = () => {
            cancelAnimationFrame(rafRef.current)
            rafRef.current = requestAnimationFrame(updateRect)
        }
        window.addEventListener('resize', onLayout)
        window.addEventListener('scroll', onLayout, true)

        return () => {
            cancelAnimationFrame(rafRef.current)
            observerRef.current?.disconnect()
            window.removeEventListener('resize', onLayout)
            window.removeEventListener('scroll', onLayout, true)
        }
    }, [targetSelector, updateRect])

    // If no target, render just a dim backdrop (for waiting state)
    if (!targetSelector) {
        return (
            <div className="fixed inset-0 z-[998] bg-base-300/60 backdrop-blur-sm transition-opacity duration-300">
                {children}
            </div>
        )
    }

    // Target not found yet — wait
    if (!rect) return null

    const padding = 8

    return (
        <div className="fixed inset-0 z-[998] pointer-events-none transition-opacity duration-300">
            {/* Click-blocking backdrop areas (4 rects around the spotlight) */}
            <div className="pointer-events-auto absolute inset-0" style={{ clipPath: `polygon(
                0% 0%, 100% 0%, 100% 100%, 0% 100%,
                0% ${rect.top - padding}px,
                ${rect.left - padding}px ${rect.top - padding}px,
                ${rect.left - padding}px ${rect.top + rect.height + padding}px,
                0% ${rect.top + rect.height + padding}px
            )` }}>
                <div className="w-full h-full bg-base-300/60 backdrop-blur-sm" />
            </div>

            {/* Spotlight cutout with pulse */}
            <div
                className="absolute rounded-xl tutorial-spotlight-pulse"
                style={{
                    top: rect.top - padding,
                    left: rect.left - padding,
                    width: rect.width + padding * 2,
                    height: rect.height + padding * 2,
                }}
            />

            {/* Tooltip container — positioned, pointer-events enabled */}
            <div className="pointer-events-auto">
                {children && typeof children === 'function'
                    ? children(rect, padding)
                    : children}
            </div>
        </div>
    )
}
