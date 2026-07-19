import { FolderOpenIcon, ChatBubbleLeftRightIcon, LightBulbIcon, AcademicCapIcon, ArrowPathIcon } from "@heroicons/react/24/outline"
import { useQuery } from "@tanstack/react-query"
import { useCallback } from "react"
import { useDispatch } from "react-redux"
import Button from "../../../../components/Button"
import { setOpenSettings } from "@shared/redux/appSlice"
import { resetTutorial, startTutorial } from "@shared/redux/tutorialSlice"
import Fieldset from "../properties/Fieldset"
import Toggle from "../properties/Toggle"

export default function GeneralSettings() {

    const dispatch = useDispatch()
    const platform = window.electron?.process?.platform
        || (navigator.platform?.includes("Mac") ? "darwin" : navigator.platform?.includes("Win") ? "win32" : "linux")
    const isMacOS = platform === "darwin"
    const isLinux = platform === "linux"

    const restartTutorial = useCallback(async () => {
        await window.electron.ipcRenderer.invoke("store-set", "hasCompletedTutorial", false)
        dispatch(setOpenSettings(null))
        dispatch(resetTutorial())
        dispatch(startTutorial())
    }, [dispatch])

    const restartSetup = useCallback(async () => {
        await window.electron.ipcRenderer.invoke("store-set", "hasCompletedSetup", false)
        dispatch(setOpenSettings(null))
        window.dispatchEvent(new Event("flowtake-run-setup"))
    }, [dispatch])

    const { data: isAutoStartEnabled, isPending: isAutoStartPending, refetch: refetchAutoStart } = useQuery({
        queryKey: ['autostart'],
        queryFn: () => window.electron.ipcRenderer.invoke("get-autostart"),
        staleTime: Infinity
    })

    const { data: contentProtectionEnabled, isPending: isContentProtPending, refetch: refetchContentProt } = useQuery({
        queryKey: ['contentProtectionEnabled'],
        queryFn: () => window.electron.ipcRenderer.invoke("get-content-protection"),
        staleTime: Infinity
    })

    const onChangeAutoStart = async (e) => {
        await window.electron.ipcRenderer.invoke("set-autostart", e.target.checked)
        refetchAutoStart()
    }

    const onChangeContentProtection = async (e) => {
        await window.electron.ipcRenderer.invoke("set-content-protection", e.target.checked)
        refetchContentProt()
    }

    const openLogsDirectory = () => { window.electron.ipcRenderer.invoke("open-logs-dir") }

    return (<div className="flex flex-col gap-4">
        <h4 className="font-semibold text-lg">General</h4>

        <Fieldset legend="Startup" description="Configure how Flowtake launches.">
            <Toggle leftLabel="Launch Flowtake on system startup" value={isAutoStartPending ? false : (isAutoStartEnabled ?? false)}
                onChange={onChangeAutoStart} disabled={isAutoStartPending}
                isIndeterminate={isAutoStartPending} />
        </Fieldset>

        <Fieldset legend="Privacy" description={isMacOS
            ? "Exclude Flowtake windows from Flowtake full-screen and area recordings. macOS no longer lets apps block system screenshots or third-party captures."
            : isLinux
                ? "Window capture protection is unavailable on Linux."
                : "Control whether Flowtake is visible in screenshots and screen recordings."}>
            {isLinux
                ? <p className="text-sm text-base-content/70">Flowtake cannot request capture protection on this platform.</p>
                : <Toggle leftLabel={isMacOS ? "Hide Flowtake from Flowtake recordings" : "Hide app from screenshots & recordings"}
                    value={isContentProtPending ? true : (contentProtectionEnabled ?? true)}
                    onChange={onChangeContentProtection} disabled={isContentProtPending}
                    isIndeterminate={isContentProtPending} />}
        </Fieldset>

        <Button icon={FolderOpenIcon} onClick={openLogsDirectory}>Open logs folder</Button>

        <Fieldset legend="Guided help" description="Re-run the short readiness setup or the interactive recording tutorial at any time.">
            <div className="flex flex-wrap gap-2">
                <Button icon={ArrowPathIcon} onClick={restartSetup}>Run setup again</Button>
                <Button icon={AcademicCapIcon} onClick={restartTutorial}>Restart tutorial</Button>
            </div>
        </Fieldset>

        <Fieldset legend="Help & Feedback">
            <div className="flex flex-wrap gap-2">
                <button type="button" className="btn btn-sm btn-ghost gap-2"
                    onClick={() => window.electron.ipcRenderer.invoke("open-url-in-browser", "https://github.com/JNX03/Flowtake/issues")}>
                    <ChatBubbleLeftRightIcon className="size-4" />
                    Send Feedback
                </button>
                <button type="button" className="btn btn-sm btn-ghost gap-2"
                    onClick={() => window.electron.ipcRenderer.invoke("open-url-in-browser", "https://github.com/JNX03/Flowtake/issues")}>
                    <LightBulbIcon className="size-4" />
                    Request a Feature
                </button>
            </div>
        </Fieldset>
    </div>)
}
