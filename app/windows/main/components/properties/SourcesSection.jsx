import { EyeIcon, EyeSlashIcon } from "@heroicons/react/20/solid"
import { useDispatch, useSelector } from "react-redux"
import { selectExtraTracks } from "@shared/redux/projectSlice"
import {
    FEATURE_IDS,
    selectFeatureConfig,
    updateFeatureConfig,
} from "@shared/redux/pluginSlice"
import Fieldset from "./Fieldset"

export default function SourcesSection() {
    const dispatch = useDispatch()
    const tracks = useSelector(selectExtraTracks) || []
    const config = useSelector(selectFeatureConfig(FEATURE_IDS.APP_RECORDING))
    const hidden = new Set(config.hiddenTrackIds || [])

    const toggle = (id) => {
        const next = new Set(hidden)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        dispatch(updateFeatureConfig({
            id: FEATURE_IDS.APP_RECORDING,
            patch: { hiddenTrackIds: [...next] },
        }))
    }

    return (
        <div className="h-full overflow-y-auto px-4 py-4">
            <Fieldset
                legend="Sources"
                description="Per-app captures from the Individual App Recording plugin. Toggle visibility to control whether a layer is included.">
                {tracks.length === 0 ? (
                    <p className="text-xs text-base-content/40">
                        No extra tracks captured for this project.
                    </p>
                ) : (
                    <div className="rounded-md border border-base-content/10 divide-y divide-base-content/5">
                        {tracks.map((t) => {
                            const isHidden = hidden.has(t.id)
                            return (
                                <div key={t.id} className="flex items-center gap-3 px-3 py-2">
                                    <div className="size-8 rounded bg-base-content/5 flex items-center justify-center text-[10px] font-mono text-base-content/50">
                                        {t.width}×{t.height}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-xs font-medium truncate">{t.name}</div>
                                        <div className="text-[10px] text-base-content/40 truncate font-mono">{t.filename}</div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => toggle(t.id)}
                                        className="btn btn-xs btn-ghost"
                                        title={isHidden ? "Show in editor" : "Hide in editor"}>
                                        {isHidden
                                            ? <EyeSlashIcon className="size-4 text-base-content/40" />
                                            : <EyeIcon className="size-4 text-primary" />}
                                    </button>
                                </div>
                            )
                        })}
                    </div>
                )}
                <p className="text-[10px] text-base-content/40 leading-snug mt-2">
                    Visibility toggles persist with your project. Audio is captured once on the main track —
                    extras are video-only.
                </p>
            </Fieldset>
        </div>
    )
}
