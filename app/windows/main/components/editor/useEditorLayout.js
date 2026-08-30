import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState
} from "react"

export const EDITOR_LAYOUT_STORAGE_KEY = "flowtake:editor-layout:v1"

const EDITOR_LAYOUT_SCHEMA_VERSION = 2
const LEGACY_EDITOR_LAYOUT_DEFAULTS = Object.freeze({
    assets: 248,
    inspector: 320,
    timeline: 260
})

export const EDITOR_LAYOUT_DEFAULTS = Object.freeze({
    assets: 312,
    inspector: 312,
    timeline: 320
})

const SIZE_LIMITS = Object.freeze({
    assets: { min: 200, max: 360 },
    inspector: { min: 260, max: 420 },
    timeline: { min: 190, max: 480 }
})

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

export function getEditorLayoutMode(width) {
    if (width >= 1180) return "wide"
    if (width >= 900) return "compact"
    return "narrow"
}

function getViewportSize() {
    return typeof window === "undefined"
        ? { width: 1280, height: 800 }
        : { width: window.innerWidth, height: window.innerHeight }
}

export function getTimelineMax(viewportHeight) {
    const height = Number(viewportHeight)
    if (!Number.isFinite(height)) return SIZE_LIMITS.timeline.max
    return Math.max(
        SIZE_LIMITS.timeline.min,
        Math.min(SIZE_LIMITS.timeline.max, Math.floor(height * 0.6))
    )
}

export function getEffectiveTimelineHeight(preferredHeight, viewportHeight) {
    const candidate = Number(preferredHeight)
    const preferred = clamp(
        Number.isFinite(candidate) ? candidate : EDITOR_LAYOUT_DEFAULTS.timeline,
        SIZE_LIMITS.timeline.min,
        SIZE_LIMITS.timeline.max
    )
    return Math.min(preferred, getTimelineMax(viewportHeight))
}

function normalizePreferredSizes(value = {}) {
    const candidateValue = value && typeof value === "object" ? value : {}
    return Object.fromEntries(
        Object.entries(EDITOR_LAYOUT_DEFAULTS).map(([kind, fallback]) => {
            const candidate = Number(candidateValue[kind])
            return [
                kind,
                clamp(
                    Number.isFinite(candidate) ? candidate : fallback,
                    SIZE_LIMITS[kind].min,
                    SIZE_LIMITS[kind].max
                )
            ]
        })
    )
}

export function normalizeEditorLayout(value = {}) {
    const candidateValue = value && typeof value === "object" ? value : {}
    const isLegacyDefaultLayout = candidateValue.layoutVersion !== EDITOR_LAYOUT_SCHEMA_VERSION
        && Object.entries(LEGACY_EDITOR_LAYOUT_DEFAULTS).every(
            ([kind, legacyDefault]) => Number(candidateValue[kind]) === legacyDefault
        )

    return {
        ...(isLegacyDefaultLayout
            ? EDITOR_LAYOUT_DEFAULTS
            : normalizePreferredSizes(candidateValue)),
        // v1 originally stored only numeric sizes. Missing preferences migrate
        // to an open docked library so the wide editor never starts as a rail.
        assetsOpen: typeof candidateValue.assetsOpen === "boolean"
            ? candidateValue.assetsOpen
            : true,
        layoutVersion: EDITOR_LAYOUT_SCHEMA_VERSION
    }
}

function loadLayout() {
    if (typeof window === "undefined") return normalizeEditorLayout()
    try {
        const saved = JSON.parse(window.localStorage.getItem(EDITOR_LAYOUT_STORAGE_KEY) || "{}")
        return normalizeEditorLayout(saved)
    } catch {
        return normalizeEditorLayout()
    }
}

export default function useEditorLayout() {
    const [viewport, setViewport] = useState(getViewportSize)
    const [layout, setLayout] = useState(loadLayout)
    const cleanupResizeRef = useRef(null)

    useEffect(() => {
        const handleResize = () => {
            const width = window.innerWidth
            const height = window.innerHeight
            setViewport(current => (
                current.width === width && current.height === height
                    ? current
                    : { width, height }
            ))
        }
        window.addEventListener("resize", handleResize)
        return () => window.removeEventListener("resize", handleResize)
    }, [])

    useEffect(() => {
        const persistTimer = window.setTimeout(() => {
            try {
                window.localStorage.setItem(EDITOR_LAYOUT_STORAGE_KEY, JSON.stringify(layout))
            } catch {
                // Layout persistence is optional; editing must still work in restricted webviews.
            }
        }, 180)
        return () => window.clearTimeout(persistTimer)
    }, [layout])

    useEffect(() => () => cleanupResizeRef.current?.(), [])

    const timelineMax = getTimelineMax(viewport.height)
    const sizes = useMemo(() => ({
        assets: layout.assets,
        inspector: layout.inspector,
        timeline: getEffectiveTimelineHeight(layout.timeline, viewport.height)
    }), [layout.assets, layout.inspector, layout.timeline, viewport.height])

    const setDockedAssetsOpen = useCallback(value => {
        setLayout(current => {
            const nextValue = typeof value === "function"
                ? value(current.assetsOpen)
                : value
            const assetsOpen = Boolean(nextValue)
            return current.assetsOpen === assetsOpen
                ? current
                : { ...current, assetsOpen }
        })
    }, [])

    const setSize = useCallback((kind, value) => {
        const limits = SIZE_LIMITS[kind]
        if (!limits) return
        setLayout(current => {
            const nextSize = clamp(value, limits.min, limits.max)
            return current[kind] === nextSize
                ? current
                : { ...current, [kind]: nextSize }
        })
    }, [])

    const startResize = useCallback((kind, event) => {
        const limits = SIZE_LIMITS[kind]
        if (!limits || event.button !== 0) return

        event.preventDefault()
        cleanupResizeRef.current?.()

        const startX = event.clientX
        const startY = event.clientY
        const startSize = sizes[kind]
        let animationFrame = null
        let pendingSize = startSize
        const previousCursor = document.body.style.cursor
        const previousUserSelect = document.body.style.userSelect

        document.body.style.cursor = kind === "timeline" ? "row-resize" : "col-resize"
        document.body.style.userSelect = "none"

        const flush = () => {
            animationFrame = null
            setSize(kind, pendingSize)
        }

        const handlePointerMove = moveEvent => {
            const pointerDelta = kind === "timeline"
                ? startY - moveEvent.clientY
                : (kind === "inspector" ? startX - moveEvent.clientX : moveEvent.clientX - startX)
            const nextSize = clamp(
                startSize + pointerDelta,
                limits.min,
                kind === "timeline" ? timelineMax : limits.max
            )
            if (nextSize === pendingSize) return
            pendingSize = nextSize
            if (animationFrame === null) animationFrame = window.requestAnimationFrame(flush)
        }

        const finish = () => {
            if (animationFrame !== null) {
                window.cancelAnimationFrame(animationFrame)
                setSize(kind, pendingSize)
            }
            window.removeEventListener("pointermove", handlePointerMove)
            window.removeEventListener("pointerup", finish)
            window.removeEventListener("pointercancel", finish)
            document.body.style.cursor = previousCursor
            document.body.style.userSelect = previousUserSelect
            cleanupResizeRef.current = null
        }

        cleanupResizeRef.current = finish
        window.addEventListener("pointermove", handlePointerMove)
        window.addEventListener("pointerup", finish, { once: true })
        window.addEventListener("pointercancel", finish, { once: true })
    }, [setSize, sizes, timelineMax])

    const nudgeSize = useCallback((kind, delta) => {
        setLayout(current => {
            const limits = SIZE_LIMITS[kind]
            if (!limits) return current
            const currentSize = kind === "timeline"
                ? Math.min(current[kind], timelineMax)
                : current[kind]
            const nextSize = clamp(
                currentSize + delta,
                limits.min,
                kind === "timeline" ? timelineMax : limits.max
            )
            return nextSize === currentSize
                ? current
                : { ...current, [kind]: nextSize }
        })
    }, [timelineMax])

    const resetSize = useCallback(kind => {
        setSize(kind, EDITOR_LAYOUT_DEFAULTS[kind])
    }, [setSize])

    const mode = getEditorLayoutMode(viewport.width)

    return {
        mode,
        sizes,
        timelineMax,
        isDockedAssetsOpen: layout.assetsOpen,
        setDockedAssetsOpen,
        assetsMode: mode === "wide" ? "docked" : "drawer",
        propertiesMode: mode === "narrow" ? "drawer" : "docked",
        startResize,
        nudgeSize,
        resetSize
    }
}
