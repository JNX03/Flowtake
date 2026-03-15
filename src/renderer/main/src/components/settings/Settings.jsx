import {
    BoltIcon,
    Cog6ToothIcon,
    ComputerDesktopIcon,
    QueueListIcon
} from "@heroicons/react/20/solid"
import { useQuery } from "@tanstack/react-query"
import { useHotkeys } from "react-hotkeys-hook"
import {
    useDispatch,
    useSelector
} from "react-redux"
import icon from "../../../../src/assets/logo.svg"
import {
    selectOpenSettings,
    setOpenSettings
} from "../../../../src/redux/appSlice"
import { selectAreHotkeysEnabled } from "../../../../src/redux/editorSlice"
import Modal from "../Modal"
import ExporterSettings from "./ExporterSettings"
import GeneralSettings from "./GeneralSettings"
import HotkeysSettings from "./HotkeysSettings"
import RecorderSettings from "./RecorderSettings"

import { SETTINGS_GENERAL, SETTINGS_RECORDER, SETTINGS_EXPORTER, SETTINGS_LICENSE, SETTINGS_HOTKEYS } from "./constants"
export { SETTINGS_GENERAL, SETTINGS_RECORDER, SETTINGS_EXPORTER, SETTINGS_LICENSE, SETTINGS_HOTKEYS }

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
        <div className="flex flex-row gap-5 flex-1 min-h-0">
            <ul className="menu bg-base-300 rounded-box shadow-lg w-56">
                <li><a className={`${openSettings === SETTINGS_GENERAL ? "menu-active" : ""}`}
                    onClick={() => dispatch(setOpenSettings(SETTINGS_GENERAL))}>
                    <Cog6ToothIcon className="h-5 w-5" />General
                </a></li>
                <li><a className={`${openSettings === SETTINGS_RECORDER ? "menu-active" : ""}`}
                    onClick={() => dispatch(setOpenSettings(SETTINGS_RECORDER))}>
                    <ComputerDesktopIcon className="h-5 w-5" />Recorder
                </a></li>
                <li><a className={`${openSettings === SETTINGS_EXPORTER ? "menu-active" : ""}`}
                    onClick={() => dispatch(setOpenSettings(SETTINGS_EXPORTER))}>
                    <QueueListIcon className="h-5 w-5" />Exporter
                </a></li>
                <li><a className={`${openSettings === SETTINGS_HOTKEYS ? "menu-active" : ""}`}
                    onClick={() => dispatch(setOpenSettings(SETTINGS_HOTKEYS))}>
                    <BoltIcon className="h-5 w-5" />Hotkeys
                    <span><kbd className="kbd kbd-sm mr-2">ctrl</kbd><kbd className="kbd kbd-sm">/</kbd></span>
                </a></li>
                <div className="flex-1 flex flex-col justify-end py-4">
                    <div className="divider"></div>
                    <span className="px-4 flex flex-row gap-2 cursor-default">
                        <div className="avatar">
                            <div className="w-5 h-5"><img src={icon} /></div>
                        </div>
                        <span className="text-sm flex-1 font-brand">
                            <span className="font-bold">Flowtake</span> {!isPending && !isError && <>{version}</>}
                        </span>
                    </span>
                </div>
            </ul>
            <div className="flex-1 flex flex-col">
                <div className="overflow-y-auto overflow-x-hidden h-full py-2">
                    {openSettings === SETTINGS_GENERAL && <GeneralSettings />}
                    {openSettings === SETTINGS_RECORDER && <RecorderSettings />}
                    {openSettings === SETTINGS_EXPORTER && <ExporterSettings />}
                    {openSettings === SETTINGS_HOTKEYS && <HotkeysSettings />}
                </div>
            </div>
        </div>
    </Modal>)
}