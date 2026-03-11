import {
    ArrowPathIcon,
    ArrowsRightLeftIcon,
    ArrowsUpDownIcon,
    ArrowUturnLeftIcon,
    ChatBubbleOvalLeftEllipsisIcon,
    TrashIcon
} from "@heroicons/react/24/outline"
import { useMutation } from "@tanstack/react-query"
import {
    useCallback,
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
    TOAST_ERROR
} from "../../../../src/helpers"
import { withGroup } from "../../../../src/redux/actionEnhancers"
import { addToast } from "../../../../src/redux/appSlice"
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

export default function TranscriptSection() {
    const [fileProgress, setFileProgress] = useState(null)
    const [preview, setPreview] = useState(null)
    const [inputLanguage, setInputLanguage] = useState(Object.keys(SubtitlesGenerator.INPUT_LANGUAGES)[0])

    const backgroundColor = useSelector(selectBackgroundColor)
    const position = useSelector(selectPosition)
    const width = useSelector(selectWidth)
    const shadowAlpha = useSelector(selectShadowAlpha)
    const transcript = useSelector(selectTranscript)
    const configs = useSelector(selectAllSubtitles)
    const totalConfigs = useSelector(selectTotalSubtitles)

    const dispatch = useDispatch()

    const { mutate, isPending } = useMutation({
        mutationFn: async () => {

            const { buffer } = await window.electron.ipcRenderer.invoke("get-camera-video-buffer")

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

                onInitiate: ({ file }) => updateFileProgress(file, null),               // file init
                onDownload: ({ file }) => updateFileProgress(file, 0),                  // file start download
                onProgress: ({ file, progress }) => updateFileProgress(file, progress), // file download progress
                onDone: ({ file }) => removeFileProgress(file),                         // file download done
                onReady: () => {                                                        // model ready
                    setFileProgress(null)
                    setPreview("")
                },
                onUpdate: ({ data }) => setPreview(data[0]),                            // inference update
                onError: () => { throw new Error("Subtitles couldn't be generated.") },
                onNetworkError: () => { throw new Error("Subtitles couldn't be generated. Please make sure you're connected to the internet to download the required resources.") }
            })

            return generator.generate(buffer, inputLanguage)
        },
        onMutate: () => {
            dispatch(setTranscript(null))
            dispatch(removeAllSubtitles())
        },
        onSuccess: data => dispatch(setTranscript(data)),
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

    return (<Card icon={<ChatBubbleOvalLeftEllipsisIcon className="w-6 h-6" />} title="Transcript">
        <Hint>
            When generating subtitles for the first time, additional resources need to be downloaded.
        </Hint>

        {totalConfigs > 0 && <>

            <Fieldset legend="Transcript">
                <div className="w-full max-h-80 overflow-y-auto text-xs">
                    {configs.map(({ text }) => text).join(" ")}
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

            <Fieldset legend="Shadow" description="Adding a Shadow to the subtitles creates depth and makes the recording look more natural.">
                <Slider value={shadowAlpha} onChange={onChangeShadowAlpha} label={"Shadow Alpha"} format={formatPercent} />
            </Fieldset>
        </>}

        {!isPending && <>
            <Fieldset legend="Generate Subtitles">
                <label className="fieldset-label">Input language</label>
                <div className="join">
                    <select className="join-item select" value={inputLanguage} onChange={e => setInputLanguage(e.target.value)}>
                        {Object.entries(SubtitlesGenerator.INPUT_LANGUAGES).map(([key, value], i) =>
                            <option key={i} value={key}>{value}</option>
                        )}
                    </select>
                    <Button
                        className="join-item"
                        onClick={mutate}
                        disabled={isPending}
                        isLoading={isPending}
                        icon={ArrowPathIcon}
                    />
                </div>
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

            <Divider>Loading model</Divider>

            {Object.entries(fileProgress).map(([file, progress], i) => (
                <div key={i}>
                    <span className="text-xs">{file}</span>
                    <progress className="progress w-full" value={progress} max="100"></progress>
                </div>
            ))}

            {Object.keys(fileProgress).length === 0 && (<progress className="progress w-full"></progress>)}
        </>}

        {preview !== null && <Fieldset legend="Preview">
            <progress className="progress w-full"></progress>
            <div className="w-full max-h-80 overflow-y-auto text-sm">
                {preview}
            </div>
        </Fieldset>}
    </Card>)
}