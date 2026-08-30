import { AreaSelector } from "@bmunozg/react-image-area"
import { CheckIcon } from "@heroicons/react/24/outline"
import { useQuery } from "@tanstack/react-query"
import { VideoSampleSink } from "mediabunny"
import PropTypes from "prop-types"
import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState
} from "react"
import { useHotkeys } from "react-hotkeys-hook"
import { useSelector } from "react-redux"
import { PROJECT_SCREEN_VIDEO } from "@shared/constants"
import Button from "../../../../components/Button"
import {
    clamp,
    toS
} from "@shared/helpers"
import { selectId } from "@shared/redux/projectSlice"
import { selectTime } from "@shared/redux/timelineSlice"
import RendererInputReader from "@shared/RendererInputReader"
import Modal from "../Modal"

const MIN_WIDTH = 10
const MIN_HEIGHT = 10
const MIN_LEFT = 0
const MIN_RIGHT = 0
const MIN_TOP = 0
const MIN_BOTTOM = 0

export default function AreaSelectorModal({
    isOpen,
    initialLeft,
    initialRight,
    initialTop,
    initialBottom,
    onClose,
    onSave,
    title
}) {

    const canvasRef = useRef(null)

    const time = useSelector(selectTime)
    const id = useSelector(selectId)

    const [userAreas, setUserAreas] = useState([])

    const { data: sample } = useQuery({
        queryKey: ['sample', id, time],
        queryFn: async () => {
            const reader = new RendererInputReader(PROJECT_SCREEN_VIDEO, { projectId: id })
            await reader.init()
            const track = await reader.input.getPrimaryVideoTrack()
            const sink = new VideoSampleSink(track)
            const sample = await sink.getSample(toS(time))
            await reader.close()
            return sample
        },
        enabled: isOpen,
        staleTime: Infinity
    })

    const getArea = useCallback((sample, left, right, top, bottom) => {
        return {
            height: (sample.displayHeight - top - bottom) / sample.displayHeight * 100,
            unit: "%",
            width: (sample.displayWidth - left - right) / sample.displayWidth * 100,
            x: left / sample.displayWidth * 100,
            y: top / sample.displayHeight * 100
        }
    }, [])

    const areas = useMemo(() => {
        if (userAreas.length > 0) return userAreas
        else if (sample) return [getArea(sample, initialLeft, initialRight, initialTop, initialBottom)]
        else return []
    }, [sample, initialBottom, initialLeft, initialRight, initialTop, userAreas, getArea])

    const maxLeft = useMemo(() =>
        sample ? sample.displayWidth / 100 * (100 - MIN_WIDTH) : 0,
        [sample])

    const maxRight = useMemo(() =>
        sample ? sample.displayWidth / 100 * (100 - MIN_WIDTH) : 0,
        [sample])

    const maxTop = useMemo(() =>
        sample ? sample.displayHeight / 100 * (100 - MIN_HEIGHT) : 0,
        [sample])

    const maxBottom = useMemo(() =>
        sample ? sample.displayHeight / 100 * (100 - MIN_HEIGHT) : 0,
        [sample])

    const closeModal = useCallback(() => {
        const canvas = canvasRef.current
        const context = canvas?.getContext?.('2d')

        if (canvas && context) {
            context.clearRect(0, 0, canvas.width, canvas.height)
        }

        onClose()
    }, [onClose])

    const left = useCallback(() => {
        if (!userAreas[0] || !sample) return 0
        return Math.round(userAreas[0].x / 100 * sample.displayWidth)
    }, [userAreas, sample])

    const right = useCallback(() => {
        if (!userAreas[0] || !sample) return 0
        return Math.round((100 - userAreas[0].width - userAreas[0].x) / 100 * sample.displayWidth)
    }, [userAreas, sample])

    const top = useCallback(() => {
        if (!userAreas[0] || !sample) return 0
        return Math.round(userAreas[0].y / 100 * sample.displayHeight)
    }, [userAreas, sample])

    const bottom = useCallback(() => {
        if (!userAreas[0] || !sample) return 0
        return Math.round((100 - userAreas[0].height - userAreas[0].y) / 100 * sample.displayHeight)
    }, [userAreas, sample])

    const canSave = Boolean(sample && userAreas[0])

    const save = useCallback(() => {
        if (!sample || !userAreas[0]) return

        onSave(left(), right(), top(), bottom())
        closeModal()
    }, [sample, userAreas, onSave, closeModal, left, right, top, bottom])

    const onChangeArea = useCallback((left, right, top, bottom) =>
        setUserAreas([getArea(sample, left, right, top, bottom)]),
        [sample, getArea])

    const onChangeLeft = useCallback(event =>
        onChangeArea(clamp(Number(event.target.value), MIN_LEFT, maxLeft), right(), top(), bottom()),
        [onChangeArea, maxLeft, right, top, bottom])

    const onChangeRight = useCallback(event =>
        onChangeArea(left(), clamp(Number(event.target.value), MIN_RIGHT, maxRight), top(), bottom()),
        [onChangeArea, left, maxRight, top, bottom])

    const onChangeTop = useCallback(event =>
        onChangeArea(left(), right(), clamp(Number(event.target.value), MIN_TOP, maxTop), bottom()),
        [onChangeArea, left, right, maxTop, bottom])

    const onChangeBottom = useCallback(event =>
        onChangeArea(left(), right(), top(), clamp(Number(event.target.value), MIN_BOTTOM, maxBottom)),
        [onChangeArea, left, right, top, maxBottom])

    useEffect(() => {
        const canvas = canvasRef.current
        const context = canvas?.getContext?.('2d')

        if (!sample || !canvas || !context) return

        canvas.width = sample.displayWidth
        canvas.height = sample.displayHeight
        sample.draw(context, 0, 0)
    }, [sample])

    useHotkeys('enter', save, { enabled: isOpen && canSave })

    return (
        <Modal isOpen={isOpen} title={title} close={closeModal}
            modalBoxClassNames="h-[calc(100dvh-1rem)] max-h-[44rem] w-[calc(100vw-1rem)] max-w-5xl overflow-hidden">
            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
                {!sample && <div className="flex min-h-0 flex-1 items-center justify-center"
                    role="status" aria-live="polite" aria-label="Loading area preview">
                    <span className="loading loading-spinner loading-md" aria-hidden="true"></span>
                </div>}
                <div className={`min-h-0 flex-1 overscroll-contain overflow-auto rounded-lg bg-base-300 ${sample ? "" : "hidden"}`}>
                    <div className="p-3 sm:p-4">
                        <AreaSelector areas={areas} maxAreas={1} minWidth={MIN_WIDTH} minHeight={MIN_HEIGHT}
                            unit="percentage" onChange={setUserAreas} globalAreaStyle={{ border: '2px solid #00b5ff', }}>
                            <canvas ref={canvasRef} className="block h-auto w-full" aria-label="Area selection preview" />
                        </AreaSelector>
                    </div>
                </div>
                <div className="flex shrink-0 flex-col gap-3 border-t border-base-content/10 pt-3 sm:flex-row sm:items-end">
                    {sample && <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 sm:grid-cols-4">
                        <fieldset className="fieldset min-w-0">
                            <legend className="fieldset-legend">Left</legend>
                            <input type="number" min={MIN_LEFT} max={maxLeft}
                                className="input input-sm w-full min-w-0" value={left()} onChange={onChangeLeft} />
                        </fieldset>
                        <fieldset className="fieldset min-w-0">
                            <legend className="fieldset-legend">Right</legend>
                            <input type="number" min={MIN_RIGHT} max={maxRight}
                                className="input input-sm w-full min-w-0" value={right()} onChange={onChangeRight} />
                        </fieldset>
                        <fieldset className="fieldset min-w-0">
                            <legend className="fieldset-legend">Top</legend>
                            <input type="number" min={MIN_TOP} max={maxTop}
                                className="input input-sm w-full min-w-0" value={top()} onChange={onChangeTop} />
                        </fieldset>
                        <fieldset className="fieldset min-w-0">
                            <legend className="fieldset-legend">Bottom</legend>
                            <input type="number" min={MIN_BOTTOM} max={maxBottom}
                                className="input input-sm w-full min-w-0" value={bottom()} onChange={onChangeBottom} />
                        </fieldset>
                    </div>}
                    <Button icon={CheckIcon} className="btn-primary w-full sm:w-auto" onClick={save}
                        disabled={!canSave}>
                        Save
                    </Button>
                </div>
            </div>
        </Modal>
    )
}

AreaSelectorModal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    initialLeft: PropTypes.number.isRequired,
    initialRight: PropTypes.number.isRequired,
    initialTop: PropTypes.number.isRequired,
    initialBottom: PropTypes.number.isRequired,
    onClose: PropTypes.func.isRequired,
    onSave: PropTypes.func.isRequired,
    title: PropTypes.string.isRequired
}
