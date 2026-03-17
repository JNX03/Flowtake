import {
    ArrowPathIcon,
    ArrowsRightLeftIcon,
    ArrowsUpDownIcon,
    ArrowUturnLeftIcon,
    ChatBubbleOvalLeftEllipsisIcon,
    MagnifyingGlassIcon,
    TrashIcon
} from "@heroicons/react/24/outline"
import { useMutation } from "@tanstack/react-query"
import {
    useCallback,
    useMemo,
    useState
} from "react"
import {
    useDispatch,
    useSelector
} from "react-redux"
import Button from "../../../../components/Button"
import Hint from "../../../../components/Hint"
import {
    formatPercent,
    TOAST_ERROR,
    TOAST_SUCCESS
} from "../../../../src/helpers"
import { withGroup } from "../../../../src/redux/actionEnhancers"
import { addToast } from "../../../../src/redux/appSlice"
import {
    selectHasMicrophoneAudio,
    selectHasSystemAudio
} from "../../../../src/redux/projectSlice"
import {
    removeAllSubtitles,
    selectAllSubtitles,
    selectBackgroundColor,
    selectPosition,
    selectShadowAlpha,
    selectTotalSubtitles,
    selectTranscript,
    selectWidth,
    setBackgroundColor,
    setPosition,
    setShadowAlpha,
    setSubtitles,
    setTextColor,
    setTranscript,
    setWidth
} from "../../../../src/redux/subtitleSlice"
import SubtitlesGenerator from "../../subtitles/SubtitlesGenerator"
import Card from "./Card"
import CoordPicker from "./CoordPicker"
import Divider from "./Divider"
import Fieldset from "./Fieldset"
import Slider from "./Slider"
import Toggle from "./Toggle"

const AUDIO_SOURCE_AUTO = "auto"
const AUDIO_SOURCE_MICROPHONE = "microphone"
const AUDIO_SOURCE_SYSTEM = "screen"

export default function TranscriptSection() {
    const [fileProgress, setFileProgress] = useState(null)
    const [preview, setPreview] = useState(null)
    const [inputLanguage, setInputLanguage] = useState(Object.keys(SubtitlesGenerator.INPUT_LANGUAGES)[0])
    const [languageSearch, setLanguageSearch] = useState("")
    const [audioSource, setAudioSource] = useState(AUDIO_SOURCE_AUTO)

    const backgroundColor = useSelector(selectBackgroundColor)
    const position = useSelector(selectPosition)
    const width = useSelector(selectWidth)
    const shadowAlpha = useSelector(selectShadowAlpha)
    const transcript = useSelector(selectTranscript)
    const configs = useSelector(selectAllSubtitles)
    const totalConfigs = useSelector(selectTotalSubtitles)
    const hasMicrophoneAudio = useSelector(selectHasMicrophoneAudio)
    const hasSystemAudio = useSelector(selectHasSystemAudio)

    const dispatch = useDispatch()

    // Filter languages based on search
    const filteredLanguages = useMemo(() => {
        if (!languageSearch.trim()) return Object.entries(SubtitlesGenerator.INPUT_LANGUAGES)
        const query = languageSearch.toLowerCase()
        return Object.entries(SubtitlesGenerator.INPUT_LANGUAGES)
            .filter(([code, name]) => name.toLowerCase().includes(query) || code.toLowerCase().includes(query))
    }, [languageSearch])

    // Determine which audio source to use
    const resolveAudioSource = useCallback(() => {
        if (audioSource !== AUDIO_SOURCE_AUTO) return audioSource
        // Auto: prefer microphone (higher quality speech), fall back to system audio
        if (hasMicrophoneAudio) return AUDIO_SOURCE_MICROPHONE
        if (hasSystemAudio) return AUDIO_SOURCE_SYSTEM
        return AUDIO_SOURCE_MICROPHONE // fallback
    }, [audioSource, hasMicrophoneAudio, hasSystemAudio])

    const hasAnyAudioSource = hasMicrophoneAudio || hasSystemAudio

    const { mutate, isPending } = useMutation({
        mutationFn: async () => {
            const source = resolveAudioSource()

            // Use extract-audio-buffer for efficient audio extraction via FFmpeg
            // This extracts only the audio track as 16kHz mono WAV, avoiding loading
            // the full video file into memory
            let buffer
            try {
                const data = await window.electron.ipcRenderer.invoke("extract-audio-buffer", source)
                if (!data || data.length === 0) {
                    // Fallback: try loading the full video buffer
                    if (source === AUDIO_SOURCE_MICROPHONE) {
                        const result = await window.electron.ipcRenderer.invoke("get-camera-video-buffer")
                        buffer = result?.buffer || result
                    } else {
                        const result = await window.electron.ipcRenderer.invoke("get-screen-video-buffer")
                        buffer = result?.buffer || result
                    }
                } else {
                    // Convert array to ArrayBuffer
                    buffer = new Uint8Array(data).buffer
                }
            } catch {
                // Fallback to original method
                if (source === AUDIO_SOURCE_MICROPHONE) {
                    const result = await window.electron.ipcRenderer.invoke("get-camera-video-buffer")
                    buffer = result?.buffer || result
                } else {
                    const result = await window.electron.ipcRenderer.invoke("get-screen-video-buffer")
                    buffer = result?.buffer || result
                }
            }

            if (!buffer || (buffer instanceof ArrayBuffer && buffer.byteLength === 0) ||
                (Array.isArray(buffer) && buffer.length === 0)) {
                throw new Error("No audio found in the selected source. Make sure the recording has audio.")
            }

            // Ensure we have an ArrayBuffer
            if (!(buffer instanceof ArrayBuffer)) {
                buffer = new Uint8Array(buffer).buffer
            }

            const updateFileProgress = (file, progress) => {
                setFileProgress(prevFiles => ({
                    ...prevFiles,
                    [file]: progress
                }))
            }

            const removeFileProgress = (file) => {
                setFileProgress(prevFiles => {
                    const newFiles = { ...prevFiles }
                    delete newFiles[file]
                    return newFiles
                })
            }

            const generator = new SubtitlesGenerator({
                onInitiate: ({ file }) => updateFileProgress(file, null),
                onDownload: ({ file }) => updateFileProgress(file, 0),
                onProgress: ({ file, progress }) => updateFileProgress(file, progress),
                onDone: ({ file }) => removeFileProgress(file),
                onReady: () => {
                    setFileProgress(null)
                    setPreview("")
                },
                onUpdate: ({ data }) => setPreview(data[0]),
                onError: () => { throw new Error("Subtitles couldn't be generated. Please try again.") },
                onNetworkError: () => { throw new Error("Subtitles couldn't be generated. Please make sure you're connected to the internet to download the required resources.") }
            })

            return generator.generate(buffer, inputLanguage)
        },
        onMutate: () => {
            dispatch(setTranscript(null))
            dispatch(removeAllSubtitles())
        },
        onSuccess: async data => {
            if (!data || data.length === 0) {
                dispatch(addToast({ type: TOAST_ERROR, text: "No speech detected in the audio." }))
                return
            }

            dispatch(setTranscript(data))

            // Create subtitle entities from transcript words
            const { default: SubtitleConfig } = await import("../../../../src/scene/subtitle/SubtitleConfig")
            const subtitleEntities = SubtitleConfig.createBulk(data)
            dispatch(setSubtitles(subtitleEntities))
            dispatch(addToast({ type: TOAST_SUCCESS, text: `Generated ${data.length} subtitle words.` }))
        },
        onError: error => dispatch(addToast({ type: TOAST_ERROR, text: error.message })),
        onSettled: () => setPreview(null)
    })

    const onChangeTheme = useCallback(event => {
        dispatch(setBackgroundColor(event.target.checked ? 0xffffff : 0x000000))
        dispatch(setTextColor(event.target.checked ? 0x000000 : 0xffffff))
    }, [dispatch])

    const onChangePosition = useCallback((position, group) => dispatch(withGroup(setPosition(position), group)), [dispatch])

    const onClickCenterHorizontally = useCallback(() => dispatch(setPosition({ ...position, x: 0.5 })), [dispatch, position])

    const onClickCenterVertically = useCallback(() => dispatch(setPosition({ ...position, y: 0.5 })), [dispatch, position])

    const onClickReset = useCallback(() => dispatch(setPosition({ x: 0.5, y: 0.8 })), [dispatch])

    const onChangeWidth = useCallback((value, group) => dispatch(withGroup(setWidth(value), group)), [dispatch])

    const onChangeShadowAlpha = useCallback((value, group) => dispatch(withGroup(setShadowAlpha(value), group)), [dispatch])

    return (<Card icon={<ChatBubbleOvalLeftEllipsisIcon className="w-6 h-6" />} title="Auto Transcribe">
        <Hint>
            Auto-generate subtitles from speech in your recording. Supports 99+ languages.
            {!hasAnyAudioSource && " No audio source detected in this recording."}
            {isPending && " First-time use downloads the AI model (~75MB)."}
        </Hint>

        {totalConfigs > 0 && <>

            <Fieldset legend="Transcript">
                <div className="w-full max-h-80 overflow-y-auto text-xs leading-relaxed">
                    {configs.map(({ text }, i) => (
                        <span key={i} className="inline">
                            {text}{" "}
                        </span>
                    ))}
                </div>
                <div className="text-xs opacity-50 mt-2">
                    {totalConfigs} words detected
                </div>
            </Fieldset>

            <Fieldset legend="Color Theme">
                <Toggle leftLabel="Dark" rightLabel="Light" value={backgroundColor === 0xffffff} onChange={onChangeTheme} />
            </Fieldset>

            <Fieldset legend="Position and Size">
                <CoordPicker coords={position} onChange={onChangePosition} />

                <div className="w-full flex justify-center">
                    <div className="join">
                        <Button icon={ArrowsRightLeftIcon} className="join-item btn-square"
                            onClick={onClickCenterHorizontally} tooltip="Center horizontally" />
                        <Button icon={ArrowsUpDownIcon} className="join-item btn-square"
                            onClick={onClickCenterVertically} tooltip="Center vertically" />
                        <Button icon={ArrowUturnLeftIcon} className="join-item btn-square" onClick={onClickReset}
                            tooltip="Reset" />
                    </div>
                </div>

                <Slider min={.1} value={width} onChange={onChangeWidth} label="Max Width" format={formatPercent} />
            </Fieldset>

            <Fieldset legend="Shadow" description="Adding a shadow to the subtitles creates depth and makes the recording look more natural.">
                <Slider value={shadowAlpha} onChange={onChangeShadowAlpha} label={"Shadow Alpha"} format={formatPercent} />
            </Fieldset>
        </>}

        {!isPending && <>
            <Fieldset legend="Generate Subtitles">
                {/* Audio Source */}
                <label className="fieldset-label">Audio source</label>
                <select className="select w-full" value={audioSource} onChange={e => setAudioSource(e.target.value)}>
                    <option value={AUDIO_SOURCE_AUTO}>
                        Auto-detect {hasMicrophoneAudio ? "(Microphone)" : hasSystemAudio ? "(System Audio)" : ""}
                    </option>
                    {hasMicrophoneAudio && (
                        <option value={AUDIO_SOURCE_MICROPHONE}>Microphone</option>
                    )}
                    {hasSystemAudio && (
                        <option value={AUDIO_SOURCE_SYSTEM}>System Audio (Screen Recording)</option>
                    )}
                </select>

                {/* Language Selection with Search */}
                <label className="fieldset-label mt-2">Speech language</label>
                <div className="relative">
                    <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 opacity-50" />
                    <input
                        type="text"
                        placeholder="Search languages..."
                        value={languageSearch}
                        onChange={e => setLanguageSearch(e.target.value)}
                        className="input input-sm w-full pl-9 mb-1"
                    />
                </div>
                <select
                    className="select w-full"
                    value={inputLanguage}
                    onChange={e => setInputLanguage(e.target.value)}
                    size={languageSearch ? Math.min(filteredLanguages.length, 6) : 1}
                >
                    {filteredLanguages.map(([key, value]) =>
                        <option key={key} value={key}>{value}</option>
                    )}
                </select>
                {languageSearch && filteredLanguages.length === 0 && (
                    <div className="text-xs opacity-50 mt-1">No languages match your search.</div>
                )}

                {/* Generate Button */}
                <div className="flex gap-2 mt-3">
                    <Button
                        className="btn-primary flex-1"
                        onClick={mutate}
                        disabled={isPending || !hasAnyAudioSource}
                        isLoading={isPending}
                        icon={ArrowPathIcon}
                    >
                        {transcript ? "Regenerate" : "Generate Subtitles"}
                    </Button>
                </div>

                {!hasAnyAudioSource && (
                    <div className="text-xs text-warning mt-2">
                        No audio source available. Record with a microphone or system audio enabled.
                    </div>
                )}
            </Fieldset>

            {transcript && <div className="flex flex-col items-center gap-2 mt-4">
                <Button
                    className="btn-error"
                    onClick={() => { dispatch(setTranscript(null)); dispatch(removeAllSubtitles()) }}
                    icon={TrashIcon}
                >
                    Delete Subtitles
                </Button>
            </div>}
        </>}

        {fileProgress && <>

            <Divider>Loading AI model</Divider>

            {Object.entries(fileProgress).map(([file, progress], i) => (
                <div key={i}>
                    <span className="text-xs truncate block">{file.split("/").pop()}</span>
                    <progress className="progress w-full" value={progress} max="100"></progress>
                </div>
            ))}

            {Object.keys(fileProgress).length === 0 && (<progress className="progress w-full"></progress>)}
        </>}

        {preview !== null && <Fieldset legend="Live Preview">
            <progress className="progress w-full"></progress>
            <div className="w-full max-h-80 overflow-y-auto text-sm">
                {preview}
            </div>
        </Fieldset>}
    </Card>)
}
