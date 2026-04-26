import { ArrowPathIcon as ArrowPathIconSmall } from "@heroicons/react/16/solid"
import { ArrowPathIcon } from "@heroicons/react/24/outline"
import { useQuery } from "@tanstack/react-query"
import {
    useCallback,
    useMemo,
    useState
} from "react"
import {
    useDispatch,
    useSelector
} from "react-redux"
import Button from "../../../../components/Button"
import Hint from "../../../../components/Hint"
import {
    selectCapturers,
    selectEncoders,
    setCapturers,
    setEncoders
} from "@shared/redux/appSlice"
import Fieldset from "../properties/Fieldset"
import SystemAudio from "./SystemAudio"

export default function RecorderSettings() {
    const dispatch = useDispatch()

    const [userCapturer, setUserCapturer] = useState("")
    const [userEncoder, setUserEncoder] = useState("")
    const [isFpsLoading, setIsFpsLoading] = useState(false)

    const capturers = useSelector(selectCapturers)
    const encoders = useSelector(selectEncoders)

    // Derive capturer from user choice or selected from Redux
    const capturer = useMemo(() => {
        if (userCapturer) return userCapturer
        if (capturers.length > 0) {
            return capturers.find(({ isSelected }) => isSelected)?.name || ""
        }
        return ""
    }, [userCapturer, capturers])

    // Derive encoder from user choice or selected from Redux  
    const encoder = useMemo(() => {
        if (userEncoder) return userEncoder
        if (encoders.length > 0) {
            return encoders.find(({ isSelected }) => isSelected)?.name || ""
        }
        return ""
    }, [userEncoder, encoders])

    const { data: fps, isPending: isPendingFps, refetch: refetchFps } = useQuery({
        queryKey: ['screenFps'],
        queryFn: () => window.electron.ipcRenderer.invoke("store-get", "screenFps"),
        staleTime: Infinity
    })

    const refreshCapturers = useCallback(async () => {
        setUserCapturer("")
        dispatch(setCapturers([]))
        dispatch(setCapturers(await window.electron.ipcRenderer.invoke("get-capturers", true) || []))
    }, [dispatch])

    const onSelectCapturer = useCallback(async ({ target }) => {
        setUserCapturer(target.value)
        await window.electron.ipcRenderer.invoke("set-capturer", target.value)
    }, [])

    const refreshEncoders = useCallback(async () => {
        setUserEncoder("")
        dispatch(setEncoders([]))
        dispatch(setEncoders(await window.electron.ipcRenderer.invoke("get-encoders", true) || []))
    }, [dispatch])

    const onSelectEncoder = useCallback(async ({ target }) => {
        setUserEncoder(target.value)
        await window.electron.ipcRenderer.invoke("set-encoder", target.value)
    }, [])

    const onSelectFps = async newFps => {
        setIsFpsLoading(true)
        await window.electron.ipcRenderer.invoke("store-set", "screenFps", newFps)
        refetchFps()
        setIsFpsLoading(false)
    }

    return (<div className="flex flex-col gap-4">
        <h4 className="font-semibold text-lg">Recorder</h4>
        <span className="block">
            <Hint>
                <span className="font-bold">Having issues recording or can&apos;t see any encoders below?</span> Flowtake tries to detect available recording options for your hardware automatically.
                Make sure your GPU drivers are up-to-date and
                click <ArrowPathIconSmall className="size-3 inline-block" /> to refresh available capturers and
                encoders.
            </Hint>
        </span>

        <SystemAudio />

        <Fieldset legend="Screen Capturing" description="Desktop Duplication API (if available) is recommended for 
        better system performance while recording.">
            <div className="label">Capturer</div>
            <div className="join">
                <select className="select join-item flex-1"
                    disabled={capturers.length === 0 || encoders.length === 0} onChange={onSelectCapturer}
                    value={capturer}>
                    {capturers.map(({ name, displayName }, i) =>
                        (<option key={i} value={name}>{displayName}</option>))}
                </select>
                <Button
                    className="join-item"
                    disabled={capturers.length === 0 || encoders.length === 0}
                    onClick={refreshCapturers}
                    icon={ArrowPathIcon}
                    isLoading={capturers.length === 0}
                />
            </div>
        </Fieldset>

        <Fieldset legend="Video Encoding" description="Media Foundation (if available) or a different hardware encoder
                is recommended for better video quality and system performance while recording.">
            <div className="label">Encoder</div>
            <div className="join">
                <select className="select join-item flex-1"
                    disabled={capturers.length === 0 || encoders.length === 0} onChange={onSelectEncoder}
                    value={encoder}>
                    {encoders.map(({ name, displayName }, i) =>
                        (<option key={i} value={name}>{displayName}</option>))}
                </select>
                <button className="btn join-item" disabled={capturers.length === 0 || encoders.length === 0}
                    onClick={refreshEncoders} >
                    {encoders.length > 0 && <ArrowPathIcon className="h-6 w-6" />}
                    {encoders.length === 0 && <span className="loading loading-spinner"></span>}
                </button>
            </div>
        </Fieldset>

        <Fieldset legend="Screen Recording Frame Rate" description="Set the frame rate for screen recording. Higher 
        frame rates result in smoother video but can affect system performance while recording.">
            <div className="label">Frame Rate</div>
            <div className="join">
                <Button className={`join-item ${fps === 30 ? "btn-info" : ""}`} disabled={isFpsLoading || isPendingFps}
                    onClick={() => onSelectFps(30)}>30FPS</Button>
                <Button className={`join-item ${fps === 60 ? "btn-info" : ""}`} disabled={isFpsLoading || isPendingFps}
                    onClick={() => onSelectFps(60)}>60FPS</Button>
            </div>
        </Fieldset>
    </div>)
}
