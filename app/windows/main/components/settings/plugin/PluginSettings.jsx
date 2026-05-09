import { CursorArrowRaysIcon, RectangleGroupIcon, CommandLineIcon } from '@heroicons/react/20/solid'
import { useDispatch, useSelector } from 'react-redux'
import {
    FEATURE_IDS,
    selectAllEnabled,
    setFeatureEnabled,
} from '@shared/redux/pluginSlice'
import PreFeatureCard from './PreFeatureCard'
import PluginFolderSection from './PluginFolderSection'
import AppRecordingFeature from './features/AppRecordingFeature'
import MouseStyleFeature from './features/MouseStyleFeature'
import KeyboardOverlayFeature from './features/KeyboardOverlayFeature'

export default function PluginSettings() {
    const dispatch = useDispatch()
    const enabled = useSelector(selectAllEnabled)

    const setEnabled = (id, val) => dispatch(setFeatureEnabled({ id, enabled: val }))

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
                <h4 className="font-semibold text-lg">Plugin & Extension</h4>
                <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold uppercase tracking-wider">
                    Research Preview
                </span>
            </div>
            <p className="text-xs text-base-content/50 -mt-2 leading-relaxed">
                Plugin and extension is research preview. Third-party plugins dropped into the folder below are
                detected but not executed in this build. The features below ship with Flowtake as built-in
                pre-extensions and can be toggled on or off.
            </p>

            <PreFeatureCard
                icon={RectangleGroupIcon}
                title="Individual App Recording"
                description="Capture multiple apps at once, then choose which layers to show in the editor."
                enabled={!!enabled[FEATURE_IDS.APP_RECORDING]}
                onToggle={(v) => setEnabled(FEATURE_IDS.APP_RECORDING, v)}>
                <AppRecordingFeature />
            </PreFeatureCard>

            <PreFeatureCard
                icon={CursorArrowRaysIcon}
                title="Mouse Coloring & Name Tag"
                description="Recolor the cursor and pin a label next to it — useful for AI-agent demos."
                enabled={!!enabled[FEATURE_IDS.MOUSE_STYLE]}
                onToggle={(v) => setEnabled(FEATURE_IDS.MOUSE_STYLE, v)}>
                <MouseStyleFeature />
            </PreFeatureCard>

            <PreFeatureCard
                icon={CommandLineIcon}
                title="Keyboard Typing Layout"
                description="Overlay keys being pressed during recording — full typing or keybinds-only mode."
                enabled={!!enabled[FEATURE_IDS.KEYBOARD_OVERLAY]}
                onToggle={(v) => setEnabled(FEATURE_IDS.KEYBOARD_OVERLAY, v)}>
                <KeyboardOverlayFeature />
            </PreFeatureCard>

            <PluginFolderSection />
        </div>
    )
}
