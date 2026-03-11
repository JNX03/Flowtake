import { ChatBubbleOvalLeftIcon } from "@heroicons/react/24/outline"
import {
    useDispatch,
    useSelector
} from "react-redux"
import {
    selectSubtitleById,
    updateSubtitle
} from "../../../../src/redux/subtitleSlice"
import {
    selectSelectedIds
} from "../../../../src/redux/timelineSlice"
import Card from "./Card"
import Fieldset from "./Fieldset"

export default function SubtitleSection() {
    const dispatch = useDispatch()

    const selectedIds = useSelector(selectSelectedIds)
    const config = useSelector(state => selectSubtitleById(state, selectedIds[0]))

    const onChange = e => dispatch(updateSubtitle({ id: config.id, changes: { text: e.target.value } }))

    return (
        <Card icon={<ChatBubbleOvalLeftIcon className="w-6 h-6" />} title="Subtitle Element" showClose={true}>
            <Fieldset legend="Content">
                <legend className="fieldset-label">Text</legend>
                <input value={config?.text || ""} onChange={onChange}
                    type="text" placeholder="Subtitle" required className={`input validator w-full`}
                    disabled={selectedIds.length !== 1} />
                <div className="validator-hint">Cannot be empty</div>
            </Fieldset>
        </Card>
    )
}