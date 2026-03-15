// Shared drag state for internal drag-and-drop.
// HTML5 dataTransfer.setData() has size limits in some WebViews
// which causes silent failures with large base64 data URLs.
// This module stores drag data in memory instead.

let _data = null
let _type = null

export function setDragItem(type, data) {
    _type = type
    _data = data
}

export function getDragItem() {
    return { type: _type, data: _data }
}

export function clearDragItem() {
    _type = null
    _data = null
}

export function hasDragItem() {
    return _data !== null
}
