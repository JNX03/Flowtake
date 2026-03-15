import {
    ArrowDownIcon,
    ArrowDownLeftIcon,
    ArrowDownRightIcon,
    ArrowLeftIcon,
    ArrowRightIcon,
    ArrowUpIcon,
    ArrowUpLeftIcon,
    ArrowUpRightIcon,
    CheckIcon,
    SwatchIcon
} from "@heroicons/react/24/outline"
import { useQuery } from "@tanstack/react-query"
import PropTypes from "prop-types"
import {
    useEffect,
    useRef,
    useState
} from "react"
import {
    useDispatch,
    useSelector
} from "react-redux"
import Button from "../../../../components/Button"
import { drawGradient } from "../../../../src/helpers"
import {
    selectBackground,
    setBackground
} from "../../../../src/redux/projectSlice"
import Modal from "../Modal"
import BackgroundPreview from "./BackgroundPreview"
import Fieldset from "./Fieldset"

const GRADIENT_UP_RIGHT = { from: { x: 0, y: 1 }, to: { x: 1, y: 0 } }
const GRADIENT_RIGHT = { from: { x: 0, y: 0 }, to: { x: 1, y: 0 } }
const GRADIENT_DOWN_RIGHT = { from: { x: 0, y: 0 }, to: { x: 1, y: 1 } }
const GRADIENT_DOWN = { from: { x: 0, y: 0 }, to: { x: 0, y: 1 } }
const GRADIENT_DOWN_LEFT = { from: { x: 1, y: 0 }, to: { x: 0, y: 1 } }
const GRADIENT_LEFT = { from: { x: 1, y: 0 }, to: { x: 0, y: 0 } }
const GRADIENT_UP_LEFT = { from: { x: 1, y: 1 }, to: { x: 0, y: 0 } }
const GRADIENT_UP = { from: { x: 0, y: 1 }, to: { x: 0, y: 0 } }

export default function Gradients() {

    const gradientCanvasRef = useRef(null)
    const dispatch = useDispatch()

    const [isModalOpen, setIsModalOpen] = useState(false)
    const [color1, setColor1] = useState("#fed187")
    const [color2, setColor2] = useState("#fd2985")
    const [color3, setColor3] = useState("#2723d8")
    const [direction, setDirection] = useState(GRADIENT_UP_RIGHT)
    const [gradientLoading, setGradientLoading] = useState(null)

    const { data: gradients, isPending, isError, refetch } = useQuery({
        queryKey: ['backgroundGradients'],
        queryFn: async () => {
            const result = await window.electron.ipcRenderer.invoke("store-get", "backgroundGradients")
            return result ?? []
        },
        staleTime: Infinity
    })

    useEffect(() => {
        if (isModalOpen) drawGradient(gradientCanvasRef.current, direction, color1, color2, color3)
    }, [isModalOpen, color1, color2, color3, direction])

    const onClickSave = async () => {
        setIsModalOpen(false)
        const id = `gradient-${self.crypto.randomUUID()}`
        setGradientLoading(id)
        const config = { color1, color2, color3, direction, id }
        const updatedGradients = [config, ...(gradients || [])]
        if (updatedGradients.length > 40) updatedGradients.pop()
        await window.electron.ipcRenderer.invoke("store-set", "backgroundGradients", updatedGradients)
        await refetch()
        dispatch(setBackground({ type: "gradient", config }))
        await window.electron.ipcRenderer.invoke("update-background", "gradient", null)
        setGradientLoading(null)
    }

    return (
        <Fieldset legend="Gradient">
            <div className="flex flex-col items-center justify-center">
                {!isPending && !isError && <div className="grid grid-cols-4 gap-1">
                    {gradients.map((gradient, i) => (<GradientPreview key={i} config={gradient} isLoading={gradientLoading === gradient.id} />))}
                </div>}
            </div>
            <div className="flex flex-col items-center justify-center mt-2">
                <Button icon={SwatchIcon} onClick={() => { setIsModalOpen(true) }} isLoading={isPending}
                    disabled={isPending || isError}>
                    New gradient
                </Button>
            </div>
            <Modal isOpen={isModalOpen} title={"New gradient"} close={() => setIsModalOpen(false)}
                modalBoxClassNames="flex flex-col h-150" >
                <Fieldset legend="Settings">
                    <div className="label">Color stops</div>
                    <div className="join">
                        <input className="btn w-20 p-2 join-item" type="color" name="color" value={color1}
                            onChange={({ target }) => setColor1(target.value)} />
                        <input className="btn w-20 p-2 join-item" type="color" name="color" value={color2}
                            onChange={({ target }) => setColor2(target.value)} />
                        <input className="btn w-20 p-2 join-item" type="color" name="color" value={color3}
                            onChange={({ target }) => setColor3(target.value)} />
                    </div>
                    <div className="label">Direction</div>
                    <div className="join">
                        <Button className={`join-item btn-square ${direction == GRADIENT_UP_RIGHT && "btn-info"}`}
                            onClick={() => { setDirection(GRADIENT_UP_RIGHT) }} icon={ArrowUpRightIcon} />
                        <Button className={`join-item btn-square ${direction == GRADIENT_RIGHT && "btn-info"}`}
                            onClick={() => { setDirection(GRADIENT_RIGHT) }} icon={ArrowRightIcon} />
                        <Button className={`join-item btn-square ${direction == GRADIENT_DOWN_RIGHT && "btn-info"}`}
                            onClick={() => { setDirection(GRADIENT_DOWN_RIGHT) }} icon={ArrowDownRightIcon} />
                        <Button className={`join-item btn-square ${direction == GRADIENT_DOWN && "btn-info"}`}
                            onClick={() => { setDirection(GRADIENT_DOWN) }} icon={ArrowDownIcon} />
                        <Button className={`join-item btn-square ${direction == GRADIENT_DOWN_LEFT && "btn-info"}`}
                            onClick={() => { setDirection(GRADIENT_DOWN_LEFT) }} icon={ArrowDownLeftIcon} />
                        <Button className={`join-item btn-square ${direction == GRADIENT_LEFT && "btn-info"}`}
                            onClick={() => { setDirection(GRADIENT_LEFT) }} icon={ArrowLeftIcon} />
                        <Button className={`join-item btn-square ${direction == GRADIENT_UP_LEFT && "btn-info"}`}
                            onClick={() => { setDirection(GRADIENT_UP_LEFT) }} icon={ArrowUpLeftIcon} />
                        <Button className={`join-item btn-square ${direction == GRADIENT_UP && "btn-info"}`}
                            onClick={() => { setDirection(GRADIENT_UP) }} icon={ArrowUpIcon} />
                    </div>
                </Fieldset>
                <canvas ref={gradientCanvasRef} className="flex-1 mt-5 w-full h-full rounded-xl overflow-hidden" />
                <div className="modal-action items-end">
                    <Button icon={CheckIcon} className="btn-primary" onClick={onClickSave}>Save</Button>
                </div>
            </Modal>
        </Fieldset>
    )
}

function GradientPreview({ config, isLoading }) {

    const dispatch = useDispatch()
    const gradientCanvasRef = useRef(null)

    const background = useSelector(selectBackground)

    useEffect(() => {
        if (config && !isLoading) {
            const { direction, color1, color2, color3 } = config
            drawGradient(gradientCanvasRef.current, direction, color1, color2, color3)
        }
    }, [config, isLoading])

    const onClickGradient = async (config) => {
        await window.electron.ipcRenderer.invoke("update-background", "gradient", null)
        dispatch(setBackground({ type: "gradient", config }))
    }

    return (<BackgroundPreview isLoading={isLoading}>
        <canvas ref={gradientCanvasRef} width="79" height="45" onClick={() => onClickGradient(config)}
            className={`w-full h-full aspect-video rounded-md cursor-pointer border-2 ${background?.config?.id == config.id ? "border-primary" : "border-transparent"}`}
        />
    </BackgroundPreview>)
}

GradientPreview.propTypes = {
    config: PropTypes.shape({
        direction: PropTypes.shape({
            from: PropTypes.shape({
                x: PropTypes.number.isRequired,
                y: PropTypes.number.isRequired
            }).isRequired,
            to: PropTypes.shape({
                x: PropTypes.number.isRequired,
                y: PropTypes.number.isRequired
            }).isRequired
        }).isRequired,
        color1: PropTypes.string.isRequired,
        color2: PropTypes.string.isRequired,
        color3: PropTypes.string.isRequired,
        id: PropTypes.string.isRequired
    }).isRequired,
    isLoading: PropTypes.bool
}