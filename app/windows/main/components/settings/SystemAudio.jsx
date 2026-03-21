import { ArrowPathIcon } from "@heroicons/react/24/outline"
import {
    useMutation,
    useQuery,
    useQueryClient
} from "@tanstack/react-query"
import { useCallback } from "react"
import Button from "../../../../components/Button"
import Fieldset from "../properties/Fieldset"

export default function SystemAudio() {

    const queryClient = useQueryClient()

    const { data: defaultDevice, isPending: isPendingDefaultDevice } = useQuery({
        queryKey: ['systemAudio'],
        queryFn: () => window.electron.ipcRenderer.invoke("store-get", "defaultSystemAudioSource"),
        staleTime: Infinity
    })

    const { data: devices, isPending: isPendingDevices } = useQuery({
        queryKey: ['audioDevices'],
        queryFn: async () => {
            const devices = await navigator.mediaDevices.enumerateDevices()
            return devices
                .filter(({ kind }) => kind === "audioinput")
                .filter(({ deviceId }) => deviceId !== "default" && deviceId !== "communications")
                .map(({ label }) => label)
        },
        staleTime: Infinity
    })

    const { mutate, isPending: isPendingMutate } = useMutation({
        mutationFn: value => window.electron.ipcRenderer.invoke("store-set", "defaultSystemAudioSource", value),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['systemAudio'] })
    })

    const onChange = useCallback(({ target }) => {
        if (target.value !== "") mutate(target.value)
    }, [mutate])

    return (<Fieldset legend="System Audio" description="Select the input device for system audio. It typically has a 
        name like 'Stereo Mix' or 'Loopback'. System audio is only available on supported audio hardware with up-to-date
        drivers. You might need to enable the system audio input device in the Windows settings.">
        <div className="label">System Audio Input</div>
        <div className="join">
            <select className="select join-item flex-1"
                disabled={!devices || devices.length === 0} onChange={onChange}
                value={defaultDevice ?? ""}>
                <option disabled={true} value="">Select a system audio input device</option>
                {devices?.map((label, i) => (<option key={i} value={label}>{label}</option>))}
            </select>
            <Button
                className="join-item"
                disabled={isPendingDevices || isPendingDefaultDevice || isPendingMutate}
                onClick={() => queryClient.invalidateQueries({ queryKey: ['audioDevices'] })}
                icon={ArrowPathIcon}
                isLoading={isPendingDevices || isPendingDefaultDevice || isPendingMutate}
            />
        </div>
    </Fieldset >)
}