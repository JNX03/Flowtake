import {
    AdjustmentsHorizontalIcon,
    ArrowsPointingOutIcon,
    Bars4Icon,
    ChatBubbleOvalLeftEllipsisIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    ComputerDesktopIcon,
    CubeIcon,
    CursorArrowRippleIcon,
    FilmIcon,
    MusicalNoteIcon,
    PhotoIcon,
    PuzzlePieceIcon,
    RectangleGroupIcon,
    Square2StackIcon,
    VideoCameraIcon,
    XMarkIcon
} from "@heroicons/react/24/outline"
import PropTypes from "prop-types"
import { useEffect } from "react"
import {
    useDispatch,
    useSelector
} from "react-redux"
import {
    AUDIO_TRACKS,
    BACKGROUND,
    CAMERA_RECORDING,
    CLICKS,
    CLIPS,
    CURSOR,
    MASKS,
    APP_SCENES,
    KEYBOARD_LAYOUTS,
    MOUSE_STYLES,
    OVERLAY_TRACKS,
    PLUGINS,
    SCREEN_RECORDING,
    SOURCES,
    SPATIALS,
    SUBTITLES,
    TRANSCRIPT,
    ZOOMS
} from "@shared/helpers"
import { selectAudioClipIds } from "@shared/redux/audioTrackSlice"
import { selectClipIds } from "@shared/redux/clipSlice"
import { selectMaskIds } from "@shared/redux/maskSlice"
import { selectOverlayIds } from "@shared/redux/overlaySlice"
import {
    selectExtraTracks,
    selectHasCameraVideo,
    selectHasMicrophoneAudio,
    selectHasSystemAudio
} from "@shared/redux/projectSlice"
import {
    selectOpenSection,
    setIsMaskingModeEnabled,
    setOpenSection,
    setSelectedIds,
    setSelectedRow
} from "@shared/redux/timelineSlice"
import { selectSpatialIds } from "@shared/redux/spatialSlice"
import { selectZoomIds } from "@shared/redux/zoomSlice"
import AudioTrackSection from "./AudioTrackSection"
import BackgroundSection from "./BackgroundSection"
import CameraSection from "./CameraSection"
import ClickSection from "./ClickSection"
import ClipSection from "./ClipSection"
import CursorSection from "./CursorSection"
import FilterSection from "./FilterSection"
import MaskSection from "./MaskSection"
import OverlaySection from "./OverlaySection"
import PluginsSection from "./PluginsSection"
import ScreenRecordingSection from "./ScreenRecordingSection"
import SourcesSection from "./SourcesSection"
import SubtitleSection from "./SubtitleSection"
import TranscriptSection from "./TranscriptSection"
import SpatialSection from "./SpatialSection"
import ZoomSection from "./ZoomSection"

function SidebarButton({ active, onClick, label, children }) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={label}
            aria-current={active ? "page" : undefined}
            data-tip={label}
            className={`flowtake-sidebar-button tooltip tooltip-left relative w-9 h-9 flex items-center justify-center rounded-md transition-colors
                ${active
                    ? "bg-base-content/10 text-primary"
                    : "text-base-content/70 hover:bg-base-content/5 hover:text-base-content"}`}
        >
            {active && <span className="absolute right-0 top-1.5 bottom-1.5 w-0.5 bg-primary rounded-l" />}
            {children}
        </button>
    )
}

SidebarButton.propTypes = {
    active: PropTypes.bool,
    onClick: PropTypes.func.isRequired,
    label: PropTypes.string.isRequired,
    children: PropTypes.node.isRequired,
}

const ICON_CLS = "w-5 h-5"

export default function Properties({
    mode = "docked",
    panelWidth = 320,
    isDrawerOpen = false,
    onDrawerChange,
    side = "right",
    showRail = true,
}) {

    const dispatch = useDispatch()

    const hasCameraVideo = useSelector(selectHasCameraVideo)
    const hasMicrophoneAudio = useSelector(selectHasMicrophoneAudio)
    const hasSystemAudio = useSelector(selectHasSystemAudio)
    const hasAnyAudio = hasMicrophoneAudio || hasSystemAudio
    const clipAnimIds = useSelector(selectClipIds)
    const zoomAnimIds = useSelector(selectZoomIds)
    const spatialAnimIds = useSelector(selectSpatialIds)
    const maskAnimIds = useSelector(selectMaskIds)
    const audioClipIds = useSelector(selectAudioClipIds)
    const overlayIds = useSelector(selectOverlayIds)
    const openSection = useSelector(selectOpenSection)
    const extraTracks = useSelector(selectExtraTracks)
    const hasExtraTracks = Array.isArray(extraTracks) && extraTracks.length > 0

    const isDrawer = mode === "drawer"

    const open = section => {
        switch (section) {
            case CLIPS:
                dispatch(setIsMaskingModeEnabled(false))
                dispatch(setSelectedIds(clipAnimIds))
                dispatch(setSelectedRow(CLIPS))
                break
            case ZOOMS:
                dispatch(setIsMaskingModeEnabled(false))
                dispatch(setSelectedIds(zoomAnimIds))
                dispatch(setSelectedRow(ZOOMS))
                break
            case SPATIALS:
                dispatch(setIsMaskingModeEnabled(false))
                dispatch(setSelectedIds(spatialAnimIds))
                dispatch(setSelectedRow(SPATIALS))
                break
            case MASKS:
                dispatch(setIsMaskingModeEnabled(true))
                dispatch(setSelectedIds(maskAnimIds))
                dispatch(setSelectedRow(MASKS))
                break
            case AUDIO_TRACKS:
                dispatch(setIsMaskingModeEnabled(false))
                dispatch(setSelectedIds(audioClipIds))
                dispatch(setSelectedRow(AUDIO_TRACKS))
                break
            case OVERLAY_TRACKS:
                dispatch(setIsMaskingModeEnabled(false))
                dispatch(setSelectedIds(overlayIds))
                dispatch(setSelectedRow(OVERLAY_TRACKS))
                break
            default:
                dispatch(setIsMaskingModeEnabled(false))
                dispatch(setSelectedIds([]))
                dispatch(setSelectedRow(null))
        }
        dispatch(setOpenSection(section))
        if (isDrawer) onDrawerChange?.(true)
    }

    useEffect(() => {
        if (!isDrawer || !isDrawerOpen) return
        const onKey = e => { if (e.key === "Escape") onDrawerChange?.(false) }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [isDrawer, isDrawerOpen, onDrawerChange])

    const iconBar = (
        <nav
            className="flowtake-icon-rail w-12 h-full shrink-0 bg-base-100 rounded-xl flex flex-col items-center py-2 gap-0.5 overflow-y-auto no-scrollbar"
            aria-label="Inspector tools"
        >
            <SidebarButton label="Screen Recording" active={openSection === SCREEN_RECORDING} onClick={() => open(SCREEN_RECORDING)}>
                <ComputerDesktopIcon className={ICON_CLS} />
            </SidebarButton>
            {hasCameraVideo && (
                <SidebarButton label="Camera Recording" active={openSection === CAMERA_RECORDING} onClick={() => open(CAMERA_RECORDING)}>
                    <VideoCameraIcon className={ICON_CLS} />
                </SidebarButton>
            )}
            <SidebarButton label="Background" active={openSection === BACKGROUND} onClick={() => open(BACKGROUND)}>
                <PhotoIcon className={ICON_CLS} />
            </SidebarButton>
            <SidebarButton label="Cursor" active={openSection === CURSOR} onClick={() => open(CURSOR)}>
                <CursorArrowRippleIcon className={ICON_CLS} />
            </SidebarButton>
            {hasAnyAudio && (
                <SidebarButton label="Auto Transcribe" active={openSection === TRANSCRIPT} onClick={() => open(TRANSCRIPT)}>
                    <ChatBubbleOvalLeftEllipsisIcon className={ICON_CLS} />
                </SidebarButton>
            )}

            <hr className="w-6 border-t border-base-content/10 my-1" />

            <SidebarButton label="Clips" active={openSection === CLIPS} onClick={() => open(CLIPS)}>
                <FilmIcon className={ICON_CLS} />
            </SidebarButton>
            <SidebarButton label="Zooms" active={openSection === ZOOMS} onClick={() => open(ZOOMS)}>
                <ArrowsPointingOutIcon className={ICON_CLS} />
            </SidebarButton>
            <SidebarButton label="Spatial 3D" active={openSection === SPATIALS} onClick={() => open(SPATIALS)}>
                <CubeIcon className={ICON_CLS} />
            </SidebarButton>
            <SidebarButton label="Masks" active={openSection === MASKS} onClick={() => open(MASKS)}>
                <Bars4Icon className={ICON_CLS} />
            </SidebarButton>
            <SidebarButton label="Filters" active={openSection === "filters"} onClick={() => open("filters")}>
                <AdjustmentsHorizontalIcon className={ICON_CLS} />
            </SidebarButton>

            <hr className="w-6 border-t border-base-content/10 my-1" />

            <SidebarButton label="Audio Tracks" active={openSection === AUDIO_TRACKS} onClick={() => open(AUDIO_TRACKS)}>
                <MusicalNoteIcon className={ICON_CLS} />
            </SidebarButton>
            <SidebarButton label="Overlays" active={openSection === OVERLAY_TRACKS} onClick={() => open(OVERLAY_TRACKS)}>
                <Square2StackIcon className={ICON_CLS} />
            </SidebarButton>

            {hasExtraTracks && (
                <SidebarButton label="Sources" active={openSection === SOURCES} onClick={() => open(SOURCES)}>
                    <RectangleGroupIcon className={ICON_CLS} />
                </SidebarButton>
            )}

            <SidebarButton label="Plugins" active={openSection === PLUGINS} onClick={() => open(PLUGINS)}>
                <PuzzlePieceIcon className={ICON_CLS} />
            </SidebarButton>

            {isDrawer && (
                <>
                    <hr className="w-6 border-t border-base-content/10 my-1" />
                    <SidebarButton
                        label={isDrawerOpen ? "Close panel" : "Open panel"}
                        active={isDrawerOpen}
                        onClick={() => onDrawerChange?.(!isDrawerOpen)}
                    >
                        {isDrawerOpen
                            ? <ChevronRightIcon className={ICON_CLS} />
                            : <ChevronLeftIcon className={ICON_CLS} />}
                    </SidebarButton>
                </>
            )}
        </nav>
    )

    const contentPanel = (
        <div className="flowtake-properties-panel h-full min-h-0 flex flex-col">
            {isDrawer && (
                <div className="flex items-center justify-between px-2 pt-2 shrink-0">
                    <span className="text-[11px] uppercase tracking-wider text-base-content/50 px-2">Properties</span>
                    <button
                        onClick={() => onDrawerChange?.(false)}
                        className="btn btn-ghost btn-xs btn-square"
                        aria-label="Close panel"
                    >
                        <XMarkIcon className="w-4 h-4" />
                    </button>
                </div>
            )}
            <div className="flex-1 min-h-0 overflow-hidden">
                {openSection === SCREEN_RECORDING && <ScreenRecordingSection />}
                {openSection === CAMERA_RECORDING && hasCameraVideo && <CameraSection />}
                {openSection === BACKGROUND && <BackgroundSection />}
                {openSection === CURSOR && <CursorSection />}
                {openSection === TRANSCRIPT && hasAnyAudio && <TranscriptSection />}
                {openSection === CLIPS && <ClipSection />}
                {openSection === CLICKS && <ClickSection />}
                {openSection === ZOOMS && <ZoomSection />}
                {openSection === SPATIALS && <SpatialSection />}
                {openSection === SUBTITLES && <SubtitleSection />}
                {openSection === MASKS && <MaskSection />}
                {openSection === "filters" && <FilterSection />}
                {openSection === AUDIO_TRACKS && <AudioTrackSection />}
                {openSection === OVERLAY_TRACKS && <OverlaySection />}
                {openSection === SOURCES && hasExtraTracks && <SourcesSection />}
                {(openSection === PLUGINS
                    || openSection === KEYBOARD_LAYOUTS
                    || openSection === MOUSE_STYLES
                    || openSection === APP_SCENES) && <PluginsSection />}
            </div>
        </div>
    )

    if (isDrawer) {
        if (!showRail && !isDrawerOpen) return null
        const drawerOffsetClass = showRail ? (side === "right" ? "right-14" : "left-14") : (side === "right" ? "right-0" : "left-0")
        return (
            <>
                {showRail && <div className="relative h-full shrink-0 z-20">{iconBar}</div>}
                {isDrawerOpen && (
                    <>
                        <button
                            type="button"
                            aria-label="Close inspector"
                            className="flowtake-panel-backdrop absolute inset-0 z-10"
                            onClick={() => onDrawerChange?.(false)}
                        />
                        <div
                            className={`flowtake-panel absolute ${drawerOffsetClass} top-0 bottom-0 z-20 bg-base-100 rounded-xl overflow-hidden`}
                            style={{
                                width: showRail
                                    ? `min(${panelWidth}px, calc(100vw - 60px))`
                                    : `min(${panelWidth + 48}px, calc(100vw - 12px))`
                            }}
                        >
                            {showRail
                                ? contentPanel
                                : (
                                    <div className="flex h-full min-w-0 gap-2 p-1.5">
                                        {iconBar}
                                        <div className="min-w-0 flex-1">{contentPanel}</div>
                                    </div>
                                )}
                        </div>
                    </>
                )}
            </>
        )
    }

    return (
        <div
            className={`flowtake-inspector-dock shrink-0 relative h-full flex gap-2 transition-[width] duration-200 ${side === "right" ? "flex-row" : "flex-row-reverse"}`}
            style={{ width: `calc(${panelWidth}px + 3rem + 0.5rem)` }}
        >
            <div className="flex-1 min-w-0 h-full">
                {contentPanel}
            </div>
            {showRail && iconBar}
        </div>
    )
}

Properties.propTypes = {
    mode: PropTypes.oneOf(["docked", "drawer"]),
    panelWidth: PropTypes.number,
    isDrawerOpen: PropTypes.bool,
    onDrawerChange: PropTypes.func,
    side: PropTypes.oneOf(["left", "right"]),
    showRail: PropTypes.bool,
}
