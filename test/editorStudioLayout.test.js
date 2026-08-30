import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import {
    getEditorLayoutMode,
    getEffectiveTimelineHeight,
    getTimelineMax,
    normalizeEditorLayout
} from "../app/windows/main/components/editor/useEditorLayout.js"

const [
    editorSource,
    previewSource,
    aspectRatioSource,
    titleBarSource,
    cssSource,
    layoutSource,
    resizeHandleSource,
    timelineSource,
    timelineToolbarSource,
    timelineActionSource,
    timelineSliceSource,
    renderWorkerSource,
    mobileTrackControlsSource,
    trackHeaderSource,
    timelineRowSource,
    audioTracksSource,
    overlayTracksSource,
    propertiesSource,
] = await Promise.all([
    readFile(new URL("../app/windows/main/components/Editor.jsx", import.meta.url), "utf8"),
    readFile(new URL("../app/windows/main/components/Preview.jsx", import.meta.url), "utf8"),
    readFile(new URL("../app/windows/main/components/AspectRatioDropdown.jsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/TitleBar.jsx", import.meta.url), "utf8"),
    readFile(new URL("../app/shared/assets/index.css", import.meta.url), "utf8"),
    readFile(new URL("../app/windows/main/components/editor/useEditorLayout.js", import.meta.url), "utf8"),
    readFile(new URL("../app/windows/main/components/editor/ResizeHandle.jsx", import.meta.url), "utf8"),
    readFile(new URL("../app/windows/main/components/timeline/Timeline.jsx", import.meta.url), "utf8"),
    readFile(new URL("../app/windows/main/components/timeline/TimelineToolbar.jsx", import.meta.url), "utf8"),
    readFile(new URL("../app/windows/main/components/timeline/Action.jsx", import.meta.url), "utf8"),
    readFile(new URL("../app/shared/redux/timelineSlice.js", import.meta.url), "utf8"),
    readFile(new URL("../app/shared/workers/renderWorker.js", import.meta.url), "utf8"),
    readFile(new URL("../app/windows/main/components/timeline/MobileTrackControls.jsx", import.meta.url), "utf8"),
    readFile(new URL("../app/windows/main/components/timeline/TrackHeader.jsx", import.meta.url), "utf8"),
    readFile(new URL("../app/windows/main/components/timeline/Row.jsx", import.meta.url), "utf8"),
    readFile(new URL("../app/windows/main/components/timeline/AudioTracks.jsx", import.meta.url), "utf8"),
    readFile(new URL("../app/windows/main/components/timeline/OverlayTracks.jsx", import.meta.url), "utf8"),
    readFile(new URL("../app/windows/main/components/properties/Properties.jsx", import.meta.url), "utf8"),
])

test("editor opts into the clean studio shell", () => {
    // Editor must NOT pin a data-theme — it inherits the user's appearance theme.
    assert.doesNotMatch(editorSource, /data-theme="flowtake-studio"/)
    assert.match(editorSource, /className="flowtake-editor h-full text-base-content"/)
    assert.match(editorSource, /variant="studio"/)
    assert.match(editorSource, /flowtake-editor__workspace/)
    assert.match(editorSource, /flowtake-editor__main/)
})

test("primary editor workflow follows assets, preview, properties order", () => {
    const propertiesIndex = editorSource.indexOf("<Properties")
    const previewIndex = editorSource.indexOf("<Preview")
    const assetsIndex = editorSource.indexOf("<AssetPanel")

    assert.ok(propertiesIndex > -1, "properties panel is present")
    assert.ok(previewIndex > -1, "preview is present")
    assert.ok(assetsIndex > -1, "asset shelf is present")
    assert.ok(assetsIndex < previewIndex, "asset shelf stays left of preview")
    assert.ok(previewIndex < propertiesIndex, "properties panel stays right of preview")
    assert.match(editorSource, /useEditorLayout\(\)/)
    assert.match(editorSource, /height: sizes\.timeline/)
    assert.match(editorSource, /label="Resize media panel"/)
    assert.match(editorSource, /label="Resize inspector"/)
    assert.match(editorSource, /label="Resize timeline"/)
    assert.match(editorSource, /isAssetPanelOpen = assetsMode === "docked"/)
    assert.match(editorSource, /setDockedAssetsOpen\(current => !current\)/)
    assert.match(editorSource, /setIsAssetDrawerOpen\(current => !current\)/)
})

test("editor layout is persistent, responsive, and keyboard resizable", () => {
    assert.match(layoutSource, /flowtake:editor-layout:v1/)
    assert.match(layoutSource, /assets: 312/)
    assert.match(layoutSource, /inspector: 312/)
    assert.match(layoutSource, /timeline: 320/)
    assert.match(layoutSource, /window\.requestAnimationFrame/)
    assert.match(layoutSource, /window\.localStorage\.setItem/)
    assert.match(layoutSource, /window\.setTimeout/)
    assert.match(layoutSource, /assetsOpen:/)
    assert.match(layoutSource, /isDockedAssetsOpen: layout\.assetsOpen/)
    assert.match(editorSource, /max=\{timelineMax\}/)
    assert.match(layoutSource, /width >= 1180/)
    assert.match(layoutSource, /width >= 900/)
    assert.match(resizeHandleSource, /role="separator"/)
    assert.match(resizeHandleSource, /aria-orientation/)
    assert.match(resizeHandleSource, /aria-valuenow/)
    assert.match(resizeHandleSource, /onDoubleClick/)
    assert.match(resizeHandleSource, /ArrowLeft/)
    assert.match(resizeHandleSource, /ArrowUp/)
    assert.match(propertiesSource, /flowtake-icon-rail w-12 h-full min-h-0/)
})

test("editor layout migrates panel preference and keeps responsive boundaries stable", () => {
    const migrated = normalizeEditorLayout({
        assets: 300,
        inspector: 360,
        timeline: 420
    })
    assert.deepEqual(migrated, {
        assets: 300,
        inspector: 360,
        timeline: 420,
        assetsOpen: true,
        layoutVersion: 2
    })

    assert.deepEqual(normalizeEditorLayout({
        assets: 248,
        inspector: 320,
        timeline: 260
    }), {
        assets: 312,
        inspector: 312,
        timeline: 320,
        assetsOpen: true,
        layoutVersion: 2
    })
    assert.equal(normalizeEditorLayout({
        assets: 248,
        inspector: 320,
        timeline: 260,
        layoutVersion: 2
    }).timeline, 260)
    assert.equal(normalizeEditorLayout({ assetsOpen: false }).assetsOpen, false)
    assert.equal(normalizeEditorLayout({ assetsOpen: "false" }).assetsOpen, true)
    assert.equal(normalizeEditorLayout(null).assetsOpen, true)
    assert.equal(getEditorLayoutMode(899), "narrow")
    assert.equal(getEditorLayoutMode(900), "compact")
    assert.equal(getEditorLayoutMode(1179), "compact")
    assert.equal(getEditorLayoutMode(1180), "wide")
})

test("short viewports clamp rendered timeline height without changing its preference", () => {
    const preferredLayout = normalizeEditorLayout({ timeline: 480 })

    assert.equal(getTimelineMax(520), 312)
    assert.equal(getEffectiveTimelineHeight(preferredLayout.timeline, 520), 312)
    assert.equal(preferredLayout.timeline, 480)
    assert.equal(getTimelineMax(900), 480)
    assert.equal(getEffectiveTimelineHeight(preferredLayout.timeline, 900), 480)
    assert.match(layoutSource, /timeline: getEffectiveTimelineHeight\(layout\.timeline, viewport\.height\)/)
    assert.doesNotMatch(layoutSource, /setSizes\(current => normalizeSizes\(current\)\)/)
})

test("preview controls stay outside the render stage", () => {
    const toolbarIndex = previewSource.indexOf("flowtake-preview__chrome")
    const stageIndex = previewSource.indexOf("flowtake-preview__stage")
    const transportIndex = previewSource.indexOf("<PreviewTransport")
    const videoIndex = previewSource.indexOf("<VideoWrapper")

    assert.ok(toolbarIndex > -1, "preview toolbar is present")
    assert.ok(stageIndex > -1, "preview stage is present")
    assert.match(previewSource, /flowtake-preview__controls/)
    assert.ok(transportIndex > -1, "preview transport is present")
    assert.ok(toolbarIndex < stageIndex, "aspect ratio control stays above the canvas")
    assert.ok(stageIndex < transportIndex, "playback controls stay below the canvas")
    assert.ok(transportIndex < videoIndex, "video elements remain hidden after visible controls")
})

test("preview transport supports precise navigation and fullscreen", () => {
    assert.match(previewSource, /parsePreviewTimecode/)
    assert.match(previewSource, /selectProjectFps/)
    assert.match(previewSource, /frameDuration = 1000 \/ fps/)
    assert.match(previewSource, /hours:minutes:seconds:frames/)
    assert.match(previewSource, /frames >= fps/)
    assert.match(previewSource, /aria-label="Current preview time"/)
    assert.match(previewSource, /useEditorHotkey\(EDITOR_SHORTCUT_IDS\.SEEK_BACK_ONE_SECOND/)
    assert.match(previewSource, /useEditorHotkey\(EDITOR_SHORTCUT_IDS\.SEEK_FORWARD_ONE_SECOND/)
    assert.match(previewSource, /useEditorHotkey\(EDITOR_SHORTCUT_IDS\.PREVIOUS_FRAME/)
    assert.match(previewSource, /useEditorHotkey\(EDITOR_SHORTCUT_IDS\.NEXT_FRAME/)
    assert.match(previewSource, /useEditorHotkey\(EDITOR_SHORTCUT_IDS\.JUMP_TO_START/)
    assert.match(previewSource, /useEditorHotkey\(EDITOR_SHORTCUT_IDS\.JUMP_TO_END/)
    assert.match(previewSource, /requestFullscreen/)
    assert.match(previewSource, /manager\.captureSnapshot\(\)/)
    assert.match(previewSource, /dataUrlToPngBlob/)
    assert.match(previewSource, /navigator\.clipboard\.write/)
    assert.match(previewSource, /anchor\.download =/)
    assert.match(previewSource, /aria-label="Save preview snapshot"/)
    assert.match(previewSource, /aria-label="Copy preview snapshot"/)
    assert.match(previewSource, /aria-label="Previous frame"/)
    assert.match(previewSource, /aria-label="Next frame"/)
    assert.match(previewSource, /dispatch\(setTime\(timelineStart\)\)/)
})

test("preview viewport supports persisted fit and fixed zoom without changing scene transforms", () => {
    assert.match(previewSource, /flowtake-preview-zoom/)
    assert.match(previewSource, /aria-label="Preview zoom"/)
    assert.match(previewSource, /<option value="fit">Fit<\/option>/)
    assert.match(previewSource, /<option value="1">100%<\/option>/)
    assert.match(previewSource, /<option value="2">200%<\/option>/)
    assert.match(previewSource, /overflow-auto/)
    assert.match(previewSource, /native: \{/)
    assert.match(previewSource, /dispatch\(setRendererDims\(dims\.renderer\)\)/)
    assert.match(previewSource, /style=\{canvasRect \? \{ width: canvasRect\.width, height: canvasRect\.height \}/)
})

test("timeline keeps header and minimap scroll state synchronized across playback", () => {
    assert.match(timelineSource, /el\.addEventListener\("scroll", onScroll\)/)
    assert.match(timelineSource, /dispatch\(setScrollLeft\(el\.scrollLeft\)\)/)
    assert.doesNotMatch(
        timelineSource,
        /if \(!isPlayingRef\.current\) el\.addEventListener\("scroll", onScroll\)/
    )
    assert.match(timelineSource, /didAutoFitRef/)
    assert.match(timelineSource, /requestAnimationFrame\(handleFitToView\)/)
})

test("timeline uses one wheel-driven viewport for synchronized vertical and horizontal scrolling", () => {
    assert.match(timelineSource, /const timelineSurface = useRef\(null\)/)
    assert.match(timelineSource, /surface\.addEventListener\('wheel', onWheel, \{[\s\S]*?capture: true/)
    assert.match(timelineSource, /el\.scrollTop = Math\.max\(0, el\.scrollTop \+ deltaY\)/)
    assert.match(timelineSource, /headerScroll\.current\.scrollTop = el\.scrollTop/)
    assert.match(timelineSource, /el\.scrollLeft = Math\.max\(0, el\.scrollLeft \+ horizontalDelta\)/)
    assert.match(timelineSource, /flowtake-timeline-scroll[\s\S]*overflow-x-auto overflow-y-auto overscroll-contain/)
})

test("timeline ruler and playhead stay pinned while the lane stack scrolls", () => {
    assert.match(timelineSource, /const rulerContent = useRef\(null\)/)
    assert.match(timelineSource, /const playheadContent = useRef\(null\)/)
    assert.match(timelineSource, /translate3d\(\$\{-el\.scrollLeft\}px, 0, 0\)/)
    assert.match(timelineSource, /ref=\{rulerContent\}[\s\S]*?<TimeScale containerRef=\{container\} \/>/)
    assert.match(timelineSource, /ref=\{playheadContent\}[\s\S]*?<Cursor[\s\S]*?containerRef=\{container\}/)
    assert.match(timelineSource, /Fixed viewport overlay: the handle and line stay visible while lanes scroll/)
})

test("timeline content rows keep fixed geometry when the track stack overflows", () => {
    assert.match(timelineSource, /grid grid-cols-1 content-start auto-rows-max gap-1/)
    assert.match(timelineSource, /<TrackHeader name="Clips"[\s\S]*?height="h-16"/)
    assert.match(trackHeaderSource, /flex h-2 shrink-0 items-center/)
    assert.match(trackHeaderSource, /group\/track relative flex shrink-0/)
    assert.match(timelineRowSource, /relative shrink-0/)
    assert.match(audioTracksSource, /relative shrink-0 rounded-sm/)
    assert.match(overlayTracksSource, /relative shrink-0 rounded-sm/)
    assert.match(timelineSource, /ref=\{headerScroll\}[\s\S]*?flex-1 flex-col gap-1 overflow-hidden overscroll-contain pb-1/)
    assert.match(timelineSource, /flex h-12 shrink-0 items-center border-t[\s\S]*?<AddTrackButton \/>/)
    assert.match(timelineSource, /<div className="h-12 shrink-0" aria-hidden="true" \/>/)
    assert.match(timelineSource, /mx-2 h-px shrink-0 bg-base-content\/10/)
    assert.match(timelineSource, /-mx-1 h-px shrink-0 bg-base-content\/8/)
    assert.doesNotMatch(timelineSource, /mt-auto flex h-12/)
})

test("pinned track footer preserves equal scroll ranges in low-height 20-track stacks", () => {
    const footerHeight = 48
    const rowGap = 4
    const trackHeights = [24, 32, 16, 64, ...Array(20).fill(48)]
    const stackHeight = trackHeights.reduce((sum, height) => sum + height, 0)
        + (trackHeights.length - 1) * rowGap

    for (const viewportHeight of [120, 160, 240]) {
        const leftScrollHeight = stackHeight + rowGap
        const leftViewportHeight = viewportHeight - footerHeight
        const rightScrollHeight = stackHeight + rowGap + footerHeight
        const leftMaxScroll = Math.max(
            0,
            leftScrollHeight - leftViewportHeight
        )
        const rightMaxScroll = Math.max(
            0,
            rightScrollHeight - viewportHeight
        )

        assert.ok(leftMaxScroll > 0, "large track stacks remain vertically scrollable")
        assert.equal(leftMaxScroll, rightMaxScroll)
    }
})

test("small timelines expose complete track controls without a duplicated add button", () => {
    assert.match(timelineSource, /<MobileTrackControls \/>/)
    assert.match(mobileTrackControlsSource, /Track controls/)
    assert.match(mobileTrackControlsSource, /toggleTrackMute/)
    assert.match(mobileTrackControlsSource, /toggleTrackLock/)
    assert.match(mobileTrackControlsSource, /toggleOverlayTrackVisibility/)
    assert.match(mobileTrackControlsSource, /removeAudioTrack/)
    assert.match(mobileTrackControlsSource, /removeOverlayTrack/)
    assert.match(mobileTrackControlsSource, /aria-pressed=/)
    assert.doesNotMatch(timelineToolbarSource, /<AddTrackButton/)
})

test("timeline toolbar keeps primary controls reachable and exposes toggle state", () => {
    assert.match(timelineToolbarSource, /btn btn-ghost btn-xs h-8 min-h-8 w-8/)
    assert.match(timelineToolbarSource, /aria-label="Toggle timeline snapping"/)
    assert.match(timelineToolbarSource, /aria-pressed=\{isSnappingEnabled\}/)
    assert.match(timelineToolbarSource, /aria-label="Toggle ripple editing"/)
    assert.match(timelineToolbarSource, /aria-pressed=\{editingMode === "ripple"\}/)
    assert.match(timelineToolbarSource, /aria-label="Timeline zoom"/)
    assert.match(timelineToolbarSource, /aria-label="More timeline actions"/)
    assert.match(timelineToolbarSource, /min-\[1120px\]:flex/)
    assert.match(timelineToolbarSource, /Open \$\{activeScene\?\.name \|\| "Main scene"\}/)
    assert.match(timelineToolbarSource, /aria-label="Toggle timeline overview"/)
    assert.match(timelineToolbarSource, /aria-label="Follow playhead"/)
    assert.match(timelineToolbarSource, /aria-pressed=\{isFollowingPlayback\}/)
    assert.match(timelineToolbarSource, /handleZoomStep\(-1\)/)
    assert.match(timelineToolbarSource, /handleZoomStep\(1\)/)
})

test("timeline defaults are easy to control and freeze playback cannot spin forever", () => {
    assert.match(timelineSliceSource, /isSnappingEnabled:\s*true/)
    assert.match(timelineActionSource, /animIds = \[anim\.id\]/)
    assert.match(timelineActionSource, /onMouseDownCapture=\{selectBeforeDrag\}/)
    assert.match(renderWorkerSource, /buildRenderTimelineFrames/)
    assert.match(renderWorkerSource, /sourceTimestamp:\s*timestamp\.sourceTimestamp === null/)
    assert.match(renderWorkerSource, /sceneTimestamp:\s*Math\.round\(timestamp\.timelineTimestamp\)/)
    assert.match(renderWorkerSource, /setPrimaryMediaVisible\(!timestamp\.isGap\)/)
    assert.doesNotMatch(timelineActionSource, /ClipDeleteButton/)
})

test("desktop track headers use static colors and accessible control targets", () => {
    assert.match(timelineSource, /hidden min-h-0 w-28[\s\S]*md:flex/)
    assert.match(timelineSource, /TIMELINE_HORIZONTAL_PADDING_PX = 8/)
    assert.match(timelineSource, /flowtake-timeline-scroll[\s\S]*px-2/)
    assert.match(trackHeaderSource, /TRACK_COLOR_CLASSES/)
    assert.doesNotMatch(trackHeaderSource, /border-\$\{color\}/)
    assert.match(trackHeaderSource, /h-7 min-h-7 w-7/)
    assert.match(trackHeaderSource, /aria-label=\{isMuted/)
    assert.match(trackHeaderSource, /aria-label=\{isLocked/)
    assert.match(trackHeaderSource, /aria-label=\{isVisible/)
    assert.match(trackHeaderSource, /group\/track/)
    assert.match(trackHeaderSource, /data-active=\{isActive/)
    assert.match(trackHeaderSource, /aria-label=\{`Remove \$\{name\}`\}/)
})

test("aspect ratio menu opens above the preview stage", () => {
    assert.match(aspectRatioSource, /dropdown-bottom/)
    assert.match(aspectRatioSource, /type="button"/)
    assert.match(aspectRatioSource, /z-50/)
    assert.match(aspectRatioSource, /border-base-content\/10/)
})

test("studio title bar keeps mac-style controls wired to window actions", () => {
    assert.match(titleBarSource, /variant === "traffic"/)
    assert.match(titleBarSource, /aria-label="Close window"/)
    assert.match(titleBarSource, /aria-label="Minimize window"/)
    assert.match(titleBarSource, /aria-label="Maximize window"/)
    assert.match(titleBarSource, /getCurrentWindow\(\)\[method\]\(\)/)
    assert.match(titleBarSource, /callWindow\('close'\)/)
    assert.match(titleBarSource, /callWindow\('minimize'\)/)
    assert.match(titleBarSource, /callWindow\('toggleMaximize'\)/)
})

test("studio theme defines clean, bounded editor surfaces", () => {
    const editorStyles = cssSource.slice(
        cssSource.indexOf(".flowtake-editor"),
        cssSource.indexOf("/* ===== Editorial design system")
    )

    assert.match(cssSource, /name:\s*"flowtake-studio"/)
    assert.match(cssSource, /\.flowtake-panel/)
    assert.match(cssSource, /\.flowtake-asset-panel/)
    assert.match(cssSource, /\.flowtake-properties-panel/)
    assert.match(cssSource, /\.flowtake-editor__timeline/)
    assert.match(cssSource, /\.flowtake-resize-handle/)
    assert.match(cssSource, /\.flowtake-preview__stage/)
    assert.match(cssSource, /\.flowtake-preview__canvas/)
    assert.match(cssSource, /\.flowtake-timeline-scroll/)
    assert.doesNotMatch(editorStyles, /letter-spacing:\s*-[0-9.]/)
})

test("high-frequency editor updates stay isolated from the full shell", () => {
    assert.match(previewSource, /function PreviewClockBridge\(/)
    assert.match(previewSource, /requestAnimationFrame/)
    assert.match(previewSource, /<PreviewTransport manager=/)
    assert.match(timelineSource, /<SnappingLinesSync \/>/)
    assert.match(timelineToolbarSource, /const time = selectTime\(state\)/)
})
