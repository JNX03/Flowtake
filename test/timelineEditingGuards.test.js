import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const [
    actionSource,
    flexibleActionSource,
    dragSource,
    audioClipSource,
    overlayItemSource,
] = await Promise.all([
    readFile(new URL("../app/windows/main/components/timeline/Action.jsx", import.meta.url), "utf8"),
    readFile(new URL("../app/windows/main/components/timeline/FlexibleAction.jsx", import.meta.url), "utf8"),
    readFile(new URL("../app/windows/main/components/timeline/useDragInteraction.js", import.meta.url), "utf8"),
    readFile(new URL("../app/windows/main/components/timeline/AudioClip.jsx", import.meta.url), "utf8"),
    readFile(new URL("../app/windows/main/components/timeline/OverlayItem.jsx", import.meta.url), "utf8"),
])

test("timeline move and trim gestures stop during playback or on locked lanes", () => {
    assert.match(flexibleActionSource, /const isPlaying = useSelector\(selectIsPlaying\)/)
    assert.match(flexibleActionSource, /const isEditingDisabled = disabled \|\| isPlaying/)
    assert.match(flexibleActionSource, /disabled: isEditingDisabled/)
    assert.match(flexibleActionSource, /isDragEnabled=\{!isEditingDisabled\}/)
    assert.match(dragSource, /const canDrag = refs\.current\.maxEnd !== null && !disabled/)
    assert.match(actionSource, /if \(!isDragEnabled/)
    assert.match(audioClipSource, /disabled=\{isTrackLocked\}/)
    assert.match(overlayItemSource, /disabled=\{isTrackLocked\}/)
})

test("canceling a live gesture restores geometry and clears transient UI state", () => {
    assert.match(dragSource, /const hadPendingGesture = d\.mode !== null/)
    assert.match(dragSource, /actionElementRef\.current\.style\.left/)
    assert.match(dragSource, /actionElementRef\.current\.style\.width/)
    assert.match(dragSource, /setIsDragging\(false\)/)
    assert.match(dragSource, /dispatch\(setActiveSnapLine\(null\)\)/)
    assert.match(dragSource, /classList\.remove\("cursor-grabbing"\)/)
})

test("cross-track moves reject locked target lanes", () => {
    assert.match(audioClipSource, /newTrackId\)\?\.locked\) return/)
    assert.match(overlayItemSource, /newTrackId\)\?\.locked\) return/)
})

test("selection supports Command and keeps Shift anchors in the active lane", () => {
    assert.doesNotMatch(actionSource, /isHotkeyPressed/)
    assert.match(actionSource, /event\.ctrlKey \|\| event\.metaKey/)
    assert.match(actionSource, /anims\.some\(item => item\.id === lastSelectedAnim\.id\)/)
    assert.match(actionSource, /event\.shiftKey && isRowSelected && hasRangeAnchor/)
})

test("timeline items expose keyboard selection and context-menu semantics", () => {
    assert.match(actionSource, /role="button"/)
    assert.match(actionSource, /tabIndex=\{!isMinimized && isClickEnabled \? 0 : -1\}/)
    assert.match(actionSource, /aria-pressed=\{isSelected\}/)
    assert.match(actionSource, /event\.key === "Enter" \|\| event\.key === " "/)
    assert.match(actionSource, /event\.key === "ContextMenu"/)
    assert.match(actionSource, /event\.shiftKey && event\.key === "F10"/)
    assert.match(actionSource, /focus-visible:ring-2/)
})

test("visual timeline items distinguish real video overlays", () => {
    assert.match(overlayItemSource, /case "video": return <FilmIcon/)
    assert.match(overlayItemSource, /case "video": return anim\.name \|\| "Video"/)
})
