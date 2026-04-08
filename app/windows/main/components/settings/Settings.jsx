import {
    ArrowPathIcon,
    BoltIcon,
    Cog6ToothIcon,
    ComputerDesktopIcon,
    LanguageIcon,
    QueueListIcon,
    SwatchIcon
} from "@heroicons/react/20/solid"
import { useQuery } from "@tanstack/react-query"
import { useHotkeys } from "react-hotkeys-hook"
import PropTypes from "prop-types"
import {
    useDispatch,
    useSelector
} from "react-redux"
import icon from "@shared/assets/logo.svg"
import {
    selectOpenSettings,
    setOpenSettings
} from "@shared/redux/appSlice"
import { selectAreHotkeysEnabled } from "@shared/redux/editorSlice"
import Modal from "../Modal"
import AppearanceSettings from "./AppearanceSettings"
import ExporterSettings from "./ExporterSettings"
import GeneralSettings from "./GeneralSettings"
import HotkeysSettings from "./HotkeysSettings"
import RecorderSettings from "./RecorderSettings"
import SpeechToTextSettings from "./SpeechToTextSettings"
import UpdatesSettings from "./UpdatesSettings"

import { SETTINGS_GENERAL, SETTINGS_APPEARANCE, SETTINGS_RECORDER, SETTINGS_EXPORTER, SETTINGS_LICENSE, SETTINGS_HOTKEYS, SETTINGS_STT, SETTINGS_UPDATES } from "./constants"
export { SETTINGS_GENERAL, SETTINGS_APPEARANCE, SETTINGS_RECORDER, SETTINGS_EXPORTER, SETTINGS_LICENSE, SETTINGS_HOTKEYS, SETTINGS_STT, SETTINGS_UPDATES }

export default function Settings() {
    const dispatch = useDispatch()

    const openSettings = useSelector(selectOpenSettings)
    const areHotkeysEnabled = useSelector(selectAreHotkeysEnabled)

    const { data: version, isPending, isError } = useQuery({
        queryKey: ['version'],
        queryFn: () => window.electron.ipcRenderer.invoke("get-version"),
        staleTime: Infinity
    })

    useHotkeys("ctrl+comma", () => dispatch(setOpenSettings(SETTINGS_GENERAL)),
        { enabled: openSettings === null && areHotkeysEnabled },
        [openSettings, areHotkeysEnabled])

    useHotkeys("ctrl+slash", () => dispatch(setOpenSettings(SETTINGS_HOTKEYS)))

    return (<Modal isOpen={!!openSettings} title={"Settings"} close={() => dispatch(setOpenSettings(null))}
        modalBoxClassNames="w-full max-w-3xl h-150 flex flex-col">
        <div className="flex flex-row gap-6 flex-1 min-h-0">
            {/* Sidebar */}
            <nav className="w-48 flex-shrink-0 flex flex-col">
                <div className="flex flex-col gap-0.5">
                    <NavItem icon={Cog6ToothIcon} label="General"
                        active={openSettings === SETTINGS_GENERAL}
                        onClick={() => dispatch(setOpenSettings(SETTINGS_GENERAL))} />
                    <NavItem icon={SwatchIcon} label="Appearance"
                        active={openSettings === SETTINGS_APPEARANCE}
                        onClick={() => dispatch(setOpenSettings(SETTINGS_APPEARANCE))} />
                    <NavItem icon={ComputerDesktopIcon} label="Recorder"
                        active={openSettings === SETTINGS_RECORDER}
                        onClick={() => dispatch(setOpenSettings(SETTINGS_RECORDER))} />
                    <NavItem icon={QueueListIcon} label="Exporter"
                        active={openSettings === SETTINGS_EXPORTER}
                        onClick={() => dispatch(setOpenSettings(SETTINGS_EXPORTER))} />
                    <NavItem icon={LanguageIcon} label="Speech to Text"
                        active={openSettings === SETTINGS_STT}
                        onClick={() => dispatch(setOpenSettings(SETTINGS_STT))} />
                    <NavItem icon={BoltIcon} label="Hotkeys"
                        active={openSettings === SETTINGS_HOTKEYS}
                        onClick={() => dispatch(setOpenSettings(SETTINGS_HOTKEYS))}
                        badge={<span className="ml-auto"><kbd className="kbd kbd-xs mr-0.5">ctrl</kbd><kbd className="kbd kbd-xs">/</kbd></span>}
                    />
                    <NavItem icon={ArrowPathIcon} label="Updates"
                        active={openSettings === SETTINGS_UPDATES}
                        onClick={() => dispatch(setOpenSettings(SETTINGS_UPDATES))} />
                </div>

                {/* Footer */}
                <div className="mt-auto pt-4 border-t border-base-content/5">
                    <div className="flex items-center gap-2 px-2">
                        <img src={icon} className="size-5 rounded" />
                        <span className="text-xs font-brand">
                            <span className="font-semibold">Flowtake</span>
                            {!isPending && !isError && <span className="text-base-content/40 ml-1">{version}</span>}
                        </span>
                    </div>
                    <button
                        onClick={() => window.electron.ipcRenderer.invoke("open-url-in-browser", "https://github.com/JNX03/Flowtake")}
                        className="flex items-center gap-1.5 px-2 mt-2 text-[11px] text-base-content/25 hover:text-base-content/50 transition-colors"
                    >
                        <GitHubIcon className="size-3" />
                        Open Source
                    </button>
                </div>
            </nav>

            {/* Content */}
            <div className="flex-1 min-w-0 border-l border-base-content/5 pl-6">
                <div className="overflow-y-auto overflow-x-hidden h-full">
                    {openSettings === SETTINGS_GENERAL && <GeneralSettings />}
                    {openSettings === SETTINGS_APPEARANCE && <AppearanceSettings />}
                    {openSettings === SETTINGS_RECORDER && <RecorderSettings />}
                    {openSettings === SETTINGS_EXPORTER && <ExporterSettings />}
                    {openSettings === SETTINGS_STT && <SpeechToTextSettings />}
                    {openSettings === SETTINGS_HOTKEYS && <HotkeysSettings />}
                    {openSettings === SETTINGS_UPDATES && <UpdatesSettings />}
                </div>
            </div>
        </div>
    </Modal>)
}

function NavItem({ icon: Icon, label, active, onClick, badge }) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm transition-all
                ${active
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-base-content/50 hover:text-base-content/80 hover:bg-base-content/5"
                }`}
        >
            <Icon className="size-4 flex-shrink-0" />
            {label}
            {badge}
        </button>
    )
}

NavItem.propTypes = {
    icon: PropTypes.elementType.isRequired,
    label: PropTypes.string.isRequired,
    active: PropTypes.bool,
    onClick: PropTypes.func.isRequired,
    badge: PropTypes.node
}

function GitHubIcon({ className }) {
    return (
        <svg className={className} viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
        </svg>
    )
}
