import { ArrowPathIcon } from "@heroicons/react/24/outline"
import {
    useMutation,
    useQuery,
    useQueryClient
} from "@tanstack/react-query"
import { useCallback, useState } from "react"
import Button from "../../../../components/Button"
import { getSystemAudioSources } from "@shared/systemAudio"
import Fieldset from "../properties/Fieldset"

export default function SystemAudio() {

    const queryClient = useQueryClient()
    const [isProbingDevices, setIsProbingDevices] = useState(false)
    const [refreshError, setRefreshError] = useState(null)

    const { data: defaultDevice, isPending: isPendingDefaultDevice } = useQuery({
        queryKey: ['systemAudio'],
        queryFn: () => window.electron.ipcRenderer.invoke("store-get", "defaultSystemAudioSource"),
        staleTime: Infinity
    })
    const { data: macosCaptureStatus } = useQuery({
        queryKey: ['macosCaptureStatus'],
        queryFn: () => window.electron.ipcRenderer.invoke("get-macos-capture-status"),
        staleTime: Infinity
    })

    const { data: devices, isPending: isPendingDevices, isFetching: isFetchingDevices } = useQuery({
        queryKey: ['systemAudioDevices'],
        queryFn: async () => {
            if (!navigator.mediaDevices?.enumerateDevices) return []
            return getSystemAudioSources(await navigator.mediaDevices.enumerateDevices())
        },
        staleTime: 30_000
    })

    const { mutate, isPending: isPendingMutate } = useMutation({
        mutationFn: value => window.electron.ipcRenderer.invoke("store-set", "defaultSystemAudioSource", value),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['systemAudio'] })
    })

    const onChange = useCallback(({ target }) => {
        mutate(target.value || null)
    }, [mutate])

    const refreshDevices = useCallback(async () => {
        setIsProbingDevices(true)
        setRefreshError(null)
        let permissionStream = null

        try {
            // Device labels are hidden in a fresh WebView until the user grants
            // media access. Only this explicit Refresh action may prompt; the
            // initial settings render remains permission-quiet.
            if (navigator.mediaDevices?.getUserMedia) {
                permissionStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
            }
        } catch (error) {
            const permissionDenied = error?.name === "NotAllowedError" || error?.name === "PermissionDeniedError"
            setRefreshError(permissionDenied
                ? "Audio permission was not granted, so device names may remain hidden."
                : "Audio devices could not be refreshed. Check that an input is available and try again.")
        } finally {
            permissionStream?.getTracks().forEach(track => track.stop())
            await queryClient.invalidateQueries({ queryKey: ['systemAudioDevices'] })
            setIsProbingDevices(false)
        }
    }, [queryClient])

    const selectedDevice = devices?.includes(defaultDevice) ? defaultDevice : ""
    const hasUnavailableStoredDevice = !!defaultDevice && !selectedDevice && !isPendingDevices
    const isRefreshing = isProbingDevices || isFetchingDevices

    if (macosCaptureStatus?.nativeSystemAudio) {
        return (
            <Fieldset legend="System Audio" description="ScreenCaptureKit captures system audio directly on macOS 13 and newer.">
                <div className="rounded-lg border border-success/20 bg-success/5 p-3 text-sm">
                    Native system audio is ready. Enable it from the recording screen; no
                    BlackHole or other loopback input is required.
                </div>
            </Fieldset>
        )
    }

    return (<Fieldset legend="System Audio" description="Flowtake only lists real loopback inputs such as Stereo Mix, Loopback, or BlackHole. A normal microphone is never treated as system audio.">
        <div className="label">System Audio Input</div>
        <div className="join w-full">
            <select className="select join-item flex-1"
                disabled={isRefreshing || isPendingDefaultDevice || isPendingMutate || !devices?.length}
                onChange={onChange}
                value={selectedDevice}>
                <option value="">System audio off</option>
                {devices?.map((label, i) => (<option key={i} value={label}>{label}</option>))}
            </select>
            <Button
                className="join-item"
                disabled={isRefreshing || isPendingDefaultDevice || isPendingMutate}
                onClick={refreshDevices}
                icon={ArrowPathIcon}
                isLoading={isRefreshing || isPendingDefaultDevice || isPendingMutate}
                aria-label="Refresh system audio devices"
            />
        </div>
        {refreshError && (
            <p className="mt-2 text-xs leading-relaxed text-warning" role="status">
                {refreshError}
            </p>
        )}
        {!isPendingDevices && devices?.length === 0 && (
            <p className="mt-2 text-xs leading-relaxed text-warning" role="status">
                No loopback input was found. Enable Stereo Mix in Windows sound settings or install a trusted loopback device, then refresh.
            </p>
        )}
        {hasUnavailableStoredDevice && (
            <p className="mt-2 text-xs leading-relaxed text-warning" role="status">
                The previously selected loopback device is no longer available. System audio will stay off until you choose a new one.
            </p>
        )}
    </Fieldset >)
}
