// Custom pointer-event-based drag-and-drop system.
// HTML5 DnD (draggable/onDragStart/onDrop) is unreliable in Tauri's WebView2,
// so we use pointer events + elementsFromPoint() for drop target detection.

const KEY = "__flowtakeDrag"
const LISTENERS_KEY = "__flowtakeDragListeners"
let suppressClickUntil = 0

if (!window[LISTENERS_KEY]) window[LISTENERS_KEY] = new Set()

function notify() {
    for (const fn of window[LISTENERS_KEY]) {
        try { fn() } catch {}
    }
}

function getState() {
    return window[KEY] || null
}

// --- Public API ---

export function getDragItem() {
    const s = getState()
    return s ? { type: s.type, data: s.data } : { type: null, data: null }
}

export function hasDragItem() {
    const s = getState()
    return s != null && s.data != null
}

export function isDragActive() {
    const s = getState()
    return s != null && s.active
}

export function consumeSuppressedAssetClick() {
    if (Date.now() >= suppressClickUntil) return false
    suppressClickUntil = 0
    return true
}

export function getDragPos() {
    const s = getState()
    return s ? { x: s.x, y: s.y } : null
}

/** Returns the current hover target zone/trackId or null */
export function getHoverTarget() {
    const s = getState()
    return s?.hoverTarget || null
}

export function clearDragItem() {
    window[KEY] = null
    notify()
}

// Legacy compat - used by AssetPanel's OS file drop (which still uses HTML5 DnD)
export function setDragItem(type, data) {
    window[KEY] = { type, data, active: false, x: 0, y: 0 }
}

export function subscribe(fn) {
    window[LISTENERS_KEY].add(fn)
    return () => window[LISTENERS_KEY].delete(fn)
}

/**
 * Start a pointer-based drag from an asset panel item.
 * Attaches window-level pointermove/pointerup listeners.
 * On pointerup, finds the drop target via elementsFromPoint and
 * dispatches a "flowtake-drop" CustomEvent on the window.
 */
export function startDrag(type, data, e) {
    const startX = e.clientX
    const startY = e.clientY
    const pointerId = e.pointerId
    const source = e.currentTarget
    let started = false

    window[KEY] = { type, data, active: false, x: startX, y: startY }

    const onMove = (ev) => {
        if (ev.pointerId !== pointerId) return
        // Require a small movement before activating (avoid accidental drags)
        if (!started) {
            const dx = ev.clientX - startX
            const dy = ev.clientY - startY
            if (dx * dx + dy * dy < 25) return
            started = true
            window[KEY] = { ...window[KEY], active: true }
            document.body.style.cursor = "grabbing"
            document.body.style.userSelect = "none"
        }
        ev.preventDefault()
        const hoverTarget = findDropTarget(ev.clientX, ev.clientY)
        window[KEY] = { ...window[KEY], x: ev.clientX, y: ev.clientY, hoverTarget }
        notify()
    }

    const cleanup = () => {
        document.removeEventListener("pointermove", onMove, true)
        document.removeEventListener("pointerup", onUp, true)
        document.removeEventListener("pointercancel", onCancel, true)
        document.body.style.cursor = ""
        document.body.style.userSelect = ""
        if (source?.hasPointerCapture?.(pointerId)) source.releasePointerCapture(pointerId)
    }

    const onUp = (ev) => {
        if (ev.pointerId !== pointerId) return
        cleanup()

        if (!started) {
            clearDragItem()
            return
        }

        // Find drop target
        const target = findDropTarget(ev.clientX, ev.clientY)
        if (target) {
            window.dispatchEvent(new CustomEvent("flowtake-drop", {
                detail: {
                    type: window[KEY]?.type,
                    data: window[KEY]?.data,
                    clientX: ev.clientX,
                    clientY: ev.clientY,
                    target
                }
            }))
        }

        suppressClickUntil = Date.now() + 500
        clearDragItem()
    }

    const onCancel = (ev) => {
        if (ev.pointerId !== pointerId) return
        cleanup()
        clearDragItem()
    }

    source?.setPointerCapture?.(pointerId)
    // Pointer events support mouse, pen, and touch in WebView2.
    document.addEventListener("pointermove", onMove, { capture: true, passive: false })
    document.addEventListener("pointerup", onUp, true)
    document.addEventListener("pointercancel", onCancel, true)
}

/**
 * Scan elements under the pointer for a [data-drop-zone] attribute.
 * Returns { zone, trackId, element, rect } or null.
 */
function findDropTarget(x, y) {
    const elements = document.elementsFromPoint(x, y)
    for (const el of elements) {
        if (el.dataset.dropZone) {
            return {
                zone: el.dataset.dropZone,
                trackId: el.dataset.dropTrackId != null ? Number(el.dataset.dropTrackId) : null,
                element: el,
                rect: el.getBoundingClientRect()
            }
        }
    }
    return null
}
