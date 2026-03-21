// Custom pointer-event-based drag-and-drop system.
// HTML5 DnD (draggable/onDragStart/onDrop) is unreliable in Tauri's WebView2,
// so we use pointer events + elementsFromPoint() for drop target detection.

const KEY = "__flowtakeDrag"
const LISTENERS_KEY = "__flowtakeDragListeners"

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
    // Prevent text selection and native drag while dragging
    e.preventDefault()

    const startX = e.clientX
    const startY = e.clientY
    let started = false

    window[KEY] = { type, data, active: false, x: startX, y: startY }

    const onMove = (ev) => {
        ev.preventDefault()
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
        const hoverTarget = findDropTarget(ev.clientX, ev.clientY)
        window[KEY] = { ...window[KEY], x: ev.clientX, y: ev.clientY, hoverTarget }
        notify()
    }

    const onUp = (ev) => {
        document.removeEventListener("mousemove", onMove, true)
        document.removeEventListener("mouseup", onUp, true)
        document.body.style.cursor = ""
        document.body.style.userSelect = ""

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

        clearDragItem()
    }

    // Use mousemove/mouseup on document (capture phase) for max compatibility with WebView2
    document.addEventListener("mousemove", onMove, true)
    document.addEventListener("mouseup", onUp, true)
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
