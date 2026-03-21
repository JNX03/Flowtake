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
        onClose()
        canvasRef.current.getContext('2d').clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
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

    const save = useCallback(() => {
        onSave(left(), right(), top(), bottom())
        onClose()
    }, [onSave, onClose, left, right, top, bottom])

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
        if (sample) {
            canvasRef.current.width = sample.displayWidth
            canvasRef.current.height = sample.displayHeight
            sample.draw(canvasRef.current.getContext('2d'), 0, 0)
        }
    }, [sample])

    useHotkeys('enter', () => save(), { enabled: isOpen })

    return (
        <Modal isOpen={isOpen} title={title} close={closeModal}
            modalBoxClassNames="w-5xl max-w-10/12 h-150 overflow-visible">
            {!sample && <div className="flex-1 flex items-center justify-center">
                <span className="loading loading-spinner loading-md"></span>
            </div>}
            <div className={`flex-1 overflow-y-auto bg-base-300 rounded-lg ${sample ? "" : "hidden"}`}>
                <div className="p-5">
                    <AreaSelector areas={areas} maxAreas={1} minWidth={MIN_WIDTH} minHeight={MIN_HEIGHT}
                        unit="percentage" onChange={setUserAreas} globalAreaStyle={{ border: '2px solid #00b5ff', }}>
                        <canvas ref={canvasRef} className="w-full" />
                    </AreaSelector>
                </div>
            </div>
            <div className="modal-action items-end">
                {sample && <div className="flex-1 flex justify-center gap-2">
                    <fieldset className="fieldset w-32">
                        <legend className="fieldset-legend">Left</legend>
                        <input type="number" min={MIN_LEFT} max={maxLeft}
                            className="input" value={left()} onChange={onChangeLeft} />
                    </fieldset>
                    <fieldset className="fieldset w-32">
                        <legend className="fieldset-legend">Right</legend>
                        <input type="number" min={MIN_RIGHT} max={maxRight}
                            className="input" value={right()} onChange={onChangeRight} />
                    </fieldset>
                    <fieldset className="fieldset w-32">
                        <legend className="fieldset-legend">Top</legend>
                        <input type="number" min={MIN_TOP} max={maxTop}
                            className="input" value={top()} onChange={onChangeTop} />
                    </fieldset>
                    <fieldset className="fieldset w-32">
                        <legend className="fieldset-legend">Bottom</legend>
                        <input type="number" min={MIN_BOTTOM} max={maxBottom}
                            className="input" value={bottom()} onChange={onChangeBottom} />
                    </fieldset>
                </div>}
                <fieldset className="fieldset">
                    <Button icon={CheckIcon} className="btn-primary" onClick={save}
                        disabled={userAreas.length === 0 || !sample}>
                        Save
                    </Button>
                </fieldset>
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