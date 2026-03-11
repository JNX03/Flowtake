import { CursorArrowRaysIcon } from "@heroicons/react/24/outline"
import {
    useMemo
} from "react"
import {
    useDispatch,
    useSelector
} from "react-redux"
import {
    selectClickEntities,
    updateClicks
} from "../../../../src/redux/clickSlice"
import {
    selectSelectedIds
} from "../../../../src/redux/timelineSlice"
import Card from "./Card"
import Fieldset from "./Fieldset"
import Toggle from "./Toggle"

export default function ClickSection() {

    const selectedIds = useSelector(selectSelectedIds)
    const entities = useSelector(selectClickEntities)

    const configs = useMemo(
        () => selectedIds.map(id => entities[id]).filter(Boolean),
        [selectedIds, entities])

    const isIndeterminate = useMemo(
        () => !configs.every(({ isActive }) => isActive === configs[0].isActive),
        [configs])

    const checked = useMemo(() => !isIndeterminate && configs[0] ? configs[0].isActive : false,
        [configs, isIndeterminate])

    const dispatch = useDispatch()

    const onChangeActive = event =>
        dispatch(updateClicks(configs.map(({ id }) => ({ id, changes: { isActive: event.target.checked } }))))

    return (<Card icon={<CursorArrowRaysIcon className="w-6 h-6" />} title="Click" showClose={true}>
        <Fieldset legend="Deactivate" description="Deactivated mouse events are ignored by Follow Cursor Zooms.">
            <Toggle leftLabel="Active" value={checked} isIndeterminate={isIndeterminate} onChange={onChangeActive}
                disabled={configs.length === 0} />
        </Fieldset>
    </Card>)
}