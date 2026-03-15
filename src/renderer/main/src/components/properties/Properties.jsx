import {
    ArrowsPointingOutIcon,
    Bars4Icon,
    ChatBubbleOvalLeftEllipsisIcon,
    ComputerDesktopIcon,
    CursorArrowRippleIcon,
    FilmIcon,
    MusicalNoteIcon,
    PhotoIcon,
    Square2StackIcon,
    VideoCameraIcon
} from "@heroicons/react/24/outline"
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
    SUBTITLES,
    TRANSCRIPT,
    ZOOMS
} from "../../../../src/helpers"
import { selectAudioClipIds } from "../../../../src/redux/audioTrackSlice"
import { selectClipIds } from "../../../../src/redux/clipSlice"
import { selectMaskIds } from "../../../../src/redux/maskSlice"
import { selectOverlayIds } from "../../../../src/redux/overlaySlice"
import {
    selectHasCameraVideo,
    selectHasMicrophoneAudio
} from "../../../../src/redux/projectSlice"
import {
    selectOpenSection,
    setIsMaskingModeEnabled,
    setOpenSection,
    setSelectedIds,
    setSelectedRow
} from "../../../../src/redux/timelineSlice"
import { selectZoomIds } from "../../../../src/redux/zoomSlice"
import AudioTrackSection from "./AudioTrackSection"
import BackgroundSection from "./BackgroundSection"
import CameraSection from "./CameraSection"
import ClickSection from "./ClickSection"
import ClipSection from "./ClipSection"
import CursorSection from "./CursorSection"
import MaskSection from "./MaskSection"
import OverlaySection from "./OverlaySection"
import ScreenRecordingSection from "./ScreenRecordingSection"
import SubtitleSection from "./SubtitleSection"
import TranscriptSection from "./TranscriptSection"
import ZoomSection from "./ZoomSection"

export default function Properties() {

    const dispatch = useDispatch()

    const hasCameraVideo = useSelector(selectHasCameraVideo)
    const hasMicrophoneAudio = useSelector(selectHasMicrophoneAudio)
    const clipAnimIds = useSelector(selectClipIds)
    const zoomAnimIds = useSelector(selectZoomIds)
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
        <div className="w-[26rem] relative">
            <div className="absolute left-0 top-0 right-0 bottom-0">
                <div className="flex flex-row gap-2 h-full">
                    <ul className="menu bg-base-100 rounded-lg overflow-y-auto no-scrollbar">
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
                        {hasMicrophoneAudio && <li>
                            <button onClick={() => open(TRANSCRIPT)}
                                className={`tooltip tooltip-left ${openSection === TRANSCRIPT ? "menu-active" : ""}`}
                                data-tip="Transcript">
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
                            <button onClick={() => open(MASKS)}
                                className={`tooltip tooltip-left ${openSection === MASKS ? "menu-active" : ""}`}
                                data-tip="Masks">
                                <Bars4Icon className="w-6 h-6" />
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
                    </ul>
                    <div className="flex-1 h-full">
                        {openSection === SCREEN_RECORDING && <ScreenRecordingSection />}
                        {openSection === CAMERA_RECORDING && hasCameraVideo && <CameraSection />}
                        {openSection === BACKGROUND && <BackgroundSection />}
                        {openSection === CURSOR && <CursorSection />}
                        {openSection === TRANSCRIPT && hasMicrophoneAudio && <TranscriptSection />}
                        {openSection === CLIPS && <ClipSection />}
                        {openSection === CLICKS && <ClickSection />}
                        {openSection === ZOOMS && <ZoomSection />}
                        {openSection === SUBTITLES && <SubtitleSection />}
                        {openSection === MASKS && <MaskSection />}
                        {openSection === AUDIO_TRACKS && <AudioTrackSection />}
                        {openSection === OVERLAY_TRACKS && <OverlaySection />}
                    </div>
                </div>
            </div>
        </div>
    )
}
