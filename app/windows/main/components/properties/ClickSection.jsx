import { CursorArrowRaysIcon } from "@heroicons/react/24/outline"
import {
    useCallback,
    useMemo
} from "react"
import {
    useDispatch,
    useSelector
} from "react-redux"
import { formatPercent, formatPx } from "@shared/helpers"
import {
    selectClickEntities,
    updateClicks
} from "@shared/redux/clickSlice"
import {
    selectSelectedIds
} from "@shared/redux/timelineSlice"
import Card from "./Card"
import Fieldset from "./Fieldset"
import Slider from "./Slider"
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

    const updateAll = useCallback((changes) =>
        dispatch(updateClicks(configs.map(({ id }) => ({ id, changes })))),
        [dispatch, configs])

    const ringEnabled = configs[0]?.ringEnabled ?? true
    const ringColor = configs[0]?.ringColor ?? "#FFCC00"
    const ringSize = configs[0]?.ringSize ?? 52
    const ringOpacity = configs[0]?.ringOpacity ?? 0.72
    const scaleAmount = configs[0]?.scaleAmount ?? 0.82

    return (<Card icon={<CursorArrowRaysIcon className="w-6 h-6" />} title="Click" showClose={true}>
        <Fieldset legend="Behavior" description="Deactivated clicks are ignored by Follow Cursor Zooms.">
            <Toggle leftLabel="Active" value={checked} isIndeterminate={isIndeterminate} onChange={onChangeActive}
                disabled={configs.length === 0} />
        </Fieldset>

        <Fieldset legend="Click Ring Effect">
            <Toggle leftLabel="Ring Effect" value={ringEnabled}
                onChange={e => updateAll({ ringEnabled: e.target.checked })}
                disabled={configs.length === 0} />

            {ringEnabled && <>
                <div className="flex items-center gap-2 mt-2">
                    <span className="text-[10px] opacity-50 w-16">Color</span>
                    <input type="color" value={ringColor}
                        onChange={e => updateAll({ ringColor: e.target.value })}
                        className="w-8 h-6 rounded border-0 cursor-pointer bg-transparent" />
                    <span className="text-[10px] opacity-40 font-mono">{ringColor}</span>
                </div>

                <Slider min={10} max={80} value={ringSize}
                    onChange={(v) => updateAll({ ringSize: v })}
                    label="Ring Size" format={formatPx} disabled={configs.length === 0} />

                <Slider value={ringOpacity}
                    onChange={(v) => updateAll({ ringOpacity: v })}
                    label="Ring Opacity" format={formatPercent} disabled={configs.length === 0} />
            </>}
        </Fieldset>

        <Fieldset legend="Cursor Shrink">
            <Slider min={0.5} value={scaleAmount}
                onChange={(v) => updateAll({ scaleAmount: v })}
                label="Shrink Amount" format={formatPercent} disabled={configs.length === 0} />
        </Fieldset>
    </Card>)
}
