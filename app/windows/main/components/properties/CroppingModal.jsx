import { WindowIcon } from "@heroicons/react/24/outline"
import {
    useState
} from "react"
import {
    useDispatch,
    useSelector
} from "react-redux"
import {
    getGroup,
    withGroup
} from "@shared/redux/actionEnhancers"
import {
    selectBottomTrim,
    selectLeftTrim,
    selectRightTrim,
    selectTopTrim,
    setBottomTrim,
    setLeftTrim,
    setRightTrim,
    setTopTrim
} from "@shared/redux/projectSlice"
import AreaSelectorModal from "./AreaSelectorModal"

export default function CroppingModal() {

    const dispatch = useDispatch()

    const leftTrim = useSelector(selectLeftTrim)
    const rightTrim = useSelector(selectRightTrim)
    const topTrim = useSelector(selectTopTrim)
    const bottomTrim = useSelector(selectBottomTrim)


    const [isModalOpen, setIsModalOpen] = useState(false)

    const toggleModal = () => setIsModalOpen(!isModalOpen)

    const save = (left, right, top, bottom) => {
        const group = getGroup("crop")
        dispatch(withGroup(setLeftTrim(left), group))
        dispatch(withGroup(setRightTrim(right), group))
        dispatch(withGroup(setTopTrim(top), group))
        dispatch(withGroup(setBottomTrim(bottom), group))
    }

    return (<>
        <button className="btn" onClick={toggleModal}>
            <WindowIcon className="h-6 w-6 scale-x-[-1]" />Crop video
        </button>
        <AreaSelectorModal
            isOpen={isModalOpen}
            initialLeft={leftTrim}
            initialRight={rightTrim}
            initialTop={topTrim}
            initialBottom={bottomTrim}
            onClose={toggleModal}
            onSave={save}
            title="Crop video"
        />
    </>)
}