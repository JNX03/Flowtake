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
    Square2StackIcon,
    VideoCameraIcon
} from "@heroicons/react/24/outline"
import PropTypes from "prop-types"
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
    OVERLAY_TRACKS,
    SCREEN_RECORDING,
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
import ScreenRecordingSection from "./ScreenRecordingSection"
import SubtitleSection from "./SubtitleSection"
import TranscriptSection from "./TranscriptSection"
import SpatialSection from "./SpatialSection"
import ZoomSection from "./ZoomSection"

export default function Properties({ isCollapsed = false, onToggle }) {

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
    }

    return (
        <div className={`${isCollapsed ? "w-12" : "w-80"} shrink-0 relative transition-all duration-200`}>
            <div className="absolute left-0 top-0 right-0 bottom-0">
                <div className="flex flex-row gap-1.5 h-full">
                    <ul className="menu bg-base-100 rounded-lg overflow-y-auto no-scrollbar shrink-0">
                        <li>
                            <button onClick={() => open(SCREEN_RECORDING)}
                                className={`tooltip tooltip-left ${openSection === SCREEN_RECORDING ? "menu-active" : ""}`}
                                data-tip="Screen Recording">
                                <ComputerDesktopIcon className="w-6 h-6" />
                            </button>
                        </li>
                        {hasCameraVideo && <li>
                            <button onClick={() => open(CAMERA_RECORDING)}
                                className={`tooltip tooltip-left ${openSection === CAMERA_RECORDING ? "menu-active" : ""}`}
                                data-tip="Camera Recording">
                                <VideoCameraIcon className="w-6 h-6" />
                            </button>
                        </li>}
                        <li>
                            <button onClick={() => open(BACKGROUND)}
                                className={`tooltip tooltip-left ${openSection === BACKGROUND ? "menu-active" : ""}`}
                                data-tip="Background">
                                <PhotoIcon className="w-6 h-6" />
                            </button>
                        </li>
                        <li>
                            <button onClick={() => open(CURSOR)}
                                className={`tooltip tooltip-left ${openSection === CURSOR ? "menu-active" : ""}`}
                                data-tip="Cursor">
                                <CursorArrowRippleIcon className="w-6 h-6" />
                            </button>
                        </li>
                        {hasAnyAudio && <li>
                            <button onClick={() => open(TRANSCRIPT)}
                                className={`tooltip tooltip-left ${openSection === TRANSCRIPT ? "menu-active" : ""}`}
                                data-tip="Auto Transcribe">
                                <ChatBubbleOvalLeftEllipsisIcon className="w-6 h-6" />
                            </button>
                        </li>}
                        <li>
                            <button onClick={() => open(CLIPS)}
                                className={`tooltip tooltip-left ${openSection === CLIPS ? "menu-active" : ""}`}
                                data-tip="Clips">
                                <FilmIcon className="w-6 h-6" />
                            </button>
                        </li>
                        <li>
                            <button onClick={() => open(ZOOMS)}
                                className={`tooltip tooltip-left ${openSection === ZOOMS ? "menu-active" : ""}`}
                                data-tip="Zooms">
                                <ArrowsPointingOutIcon className="w-6 h-6" />
                            </button>
                        </li>
                        <li>
                            <button onClick={() => open(SPATIALS)}
                                className={`tooltip tooltip-left ${openSection === SPATIALS ? "menu-active" : ""}`}
                                data-tip="Spatial 3D">
                                <CubeIcon className="w-6 h-6" />
                            </button>
                        </li>
                        <li>
                            <button onClick={() => open(MASKS)}
                                className={`tooltip tooltip-left ${openSection === MASKS ? "menu-active" : ""}`}
                                data-tip="Masks">
                                <Bars4Icon className="w-6 h-6" />
                            </button>
                        </li>
                        <li>
                            <button onClick={() => open("filters")}
                                className={`tooltip tooltip-left ${openSection === "filters" ? "menu-active" : ""}`}
                                data-tip="Filters">
                                <AdjustmentsHorizontalIcon className="w-6 h-6" />
                            </button>
                        </li>
                        <div className="divider my-0" />
                        <li>
                            <button onClick={() => open(AUDIO_TRACKS)}
                                className={`tooltip tooltip-left ${openSection === AUDIO_TRACKS ? "menu-active" : ""}`}
                                data-tip="Audio Tracks">
                                <MusicalNoteIcon className="w-6 h-6" />
                            </button>
                        </li>
                        <li>
                            <button onClick={() => open(OVERLAY_TRACKS)}
                                className={`tooltip tooltip-left ${openSection === OVERLAY_TRACKS ? "menu-active" : ""}`}
                                data-tip="Overlays">
                                <Square2StackIcon className="w-6 h-6" />
                            </button>
                        </li>
                        {onToggle && <>
                            <div className="divider my-0" />
                            <li>
                                <button onClick={onToggle}
                                    className="tooltip tooltip-left"
                                    data-tip={isCollapsed ? "Expand panel" : "Collapse panel"}>
                                    {isCollapsed
                                        ? <ChevronLeftIcon className="w-5 h-5" />
                                        : <ChevronRightIcon className="w-5 h-5" />}
                                </button>
                            </li>
                        </>}
                    </ul>
                    {!isCollapsed && <div className="flex-1 h-full">
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
                    </div>}
                </div>
            </div>
        </div>
    )
}

Properties.propTypes = {
    isCollapsed: PropTypes.bool,
    onToggle: PropTypes.func
}
