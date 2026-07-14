import { ArrowPathIcon } from "@heroicons/react/24/outline"
import { useQuery } from "@tanstack/react-query"
import { useCallback, useMemo, useState } from "react"
import { useDispatch, useSelector } from "react-redux"
import Button from "../../../../components/Button"
import Hint from "../../../../components/Hint"
import {
    selectCapturers,
    selectEncoders,
    setCapturers,
    setEncoders,
} from "@shared/redux/appSlice"
import Fieldset from "../properties/Fieldset"
import SystemAudio from "./SystemAudio"

const optionValue = item => item?.value ?? item?.name ?? ""
const optionLabel = item => item?.displayName ?? item?.name ?? item?.value ?? "Unknown"

export default function RecorderSettings() {
    const dispatch = useDispatch()
    const capturers = useSelector(selectCapturers)
    const encoders = useSelector(selectEncoders)

    const [userCapturer, setUserCapturer] = useState(null)
    const [userEncoder, setUserEncoder] = useState(null)
    const [isCapturerLoading, setIsCapturerLoading] = useState(false)
    const [isEncoderLoading, setIsEncoderLoading] = useState(false)
    const [engineError, setEngineError] = useState(null)
    const [isFpsLoading, setIsFpsLoading] = useState(false)
    const [isQualityLoading, setIsQualityLoading] = useState(false)

    const capturer = useMemo(() => {
        if (userCapturer) return userCapturer
        return optionValue(capturers.find(item => item.isSelected)) || optionValue(capturers[0])
    }, [userCapturer, capturers])

    const encoder = useMemo(() => {
        if (userEncoder) return userEncoder
        return optionValue(encoders.find(item => item.isSelected)) || optionValue(encoders[0])
    }, [userEncoder, encoders])

    const { data: fps, isPending: isPendingFps, refetch: refetchFps } = useQuery({
        queryKey: ['screenFps'],
        queryFn: () => window.electron.ipcRenderer.invoke("store-get", "screenFps"),
        staleTime: Infinity,
    })

    const { data: quality, isPending: isPendingQuality, refetch: refetchQuality } = useQuery({
        queryKey: ['recordingQuality'],
        queryFn: () => window.electron.ipcRenderer.invoke("store-get", "recordingQuality"),
        staleTime: Infinity,
    })

    const refreshCapturers = useCallback(async () => {
        setIsCapturerLoading(true)
        setEngineError(null)
        try {
            const next = await window.electron.ipcRenderer.invoke("get-capturers", true)
            dispatch(setCapturers(Array.isArray(next) ? next : []))
            setUserCapturer(null)
        } catch (error) {
            setEngineError(error?.message || "Could not detect screen capture engines.")
        } finally {
            setIsCapturerLoading(false)
        }
    }, [dispatch])

    const refreshEncoders = useCallback(async () => {
        setIsEncoderLoading(true)
        setEngineError(null)
        try {
            const next = await window.electron.ipcRenderer.invoke("get-encoders", true)
            dispatch(setEncoders(Array.isArray(next) ? next : []))
            setUserEncoder(null)
        } catch (error) {
            setEngineError(error?.message || "Could not detect video encoders.")
        } finally {
            setIsEncoderLoading(false)
        }
    }, [dispatch])

    const onSelectCapturer = useCallback(async ({ target }) => {
        const value = target.value
        setUserCapturer(value)
        setEngineError(null)
        try {
            await window.electron.ipcRenderer.invoke("set-capturer", value)
            const next = await window.electron.ipcRenderer.invoke("get-capturers")
            dispatch(setCapturers(Array.isArray(next) ? next : []))
            setUserCapturer(null)
        } catch (error) {
            setUserCapturer(null)
            setEngineError(error?.message || "Could not select that capture engine.")
        }
    }, [dispatch])

    const onSelectEncoder = useCallback(async ({ target }) => {
        const value = target.value
        setUserEncoder(value)
        setEngineError(null)
        try {
            await window.electron.ipcRenderer.invoke("set-encoder", value)
            const next = await window.electron.ipcRenderer.invoke("get-encoders")
            dispatch(setEncoders(Array.isArray(next) ? next : []))
            setUserEncoder(null)
        } catch (error) {
            setUserEncoder(null)
            setEngineError(error?.message || "Could not select that encoder.")
        }
    }, [dispatch])

    const onSelectFps = async newFps => {
        setIsFpsLoading(true)
        try {
            await window.electron.ipcRenderer.invoke("store-set", "screenFps", newFps)
            await refetchFps()
        } finally {
            setIsFpsLoading(false)
        }
    }

    const onSelectQuality = async ({ target }) => {
        setIsQualityLoading(true)
        try {
            await window.electron.ipcRenderer.invoke("store-set", "recordingQuality", target.value)
            await refetchQuality()
        } finally {
            setIsQualityLoading(false)
        }
    }

    return (<div className="flex flex-col gap-4">
        <h4 className="font-semibold text-lg">Recorder</h4>
        <Hint>
            Flowtake probes the device and selects a compatible low-overhead capture and encoding path.
            Use refresh after changing a GPU, display adapter, driver, or screen-recording permission.
        </Hint>

        <SystemAudio />

        <Fieldset legend="Screen capture" description="Desktop duplication is preferred when the device supports it because it reduces CPU and memory traffic.">
            <label className="label" htmlFor="capture-engine">Capture engine</label>
            <div className="join w-full">
                <select
                    id="capture-engine"
                    aria-label="Screen capture engine"
                    className="select join-item flex-1 min-w-0"
                    disabled={isCapturerLoading}
                    onChange={onSelectCapturer}
                    value={capturer}
                >
                    {capturers.length === 0 && <option value="">No capture engine detected</option>}
                    {capturers.map((item, index) => (
                        <option key={`${optionValue(item)}-${index}`} value={optionValue(item)}>
                            {optionLabel(item)}
                        </option>
                    ))}
                </select>
                <button
                    type="button"
                    className="btn join-item btn-square"
                    onClick={refreshCapturers}
                    disabled={isCapturerLoading}
                    aria-label="Refresh screen capture engines"
                >
                    {isCapturerLoading
                        ? <span className="loading loading-spinner loading-sm" />
                        : <ArrowPathIcon className="size-5" />}
                </button>
            </div>
        </Fieldset>

        <Fieldset legend="Video encoding" description="Flowtake validates available encoders on this device. Hardware encoders usually provide the lowest recording overhead.">
            <label className="label" htmlFor="video-encoder">Encoder</label>
            <div className="join w-full">
                <select
                    id="video-encoder"
                    aria-label="Video encoder"
                    className="select join-item flex-1 min-w-0"
                    disabled={isEncoderLoading}
                    onChange={onSelectEncoder}
                    value={encoder}
                >
                    {encoders.length === 0 && <option value="">No compatible encoder detected</option>}
                    {encoders.map((item, index) => (
                        <option key={`${optionValue(item)}-${index}`} value={optionValue(item)}>
                            {optionLabel(item)}
                        </option>
                    ))}
                </select>
                <button
                    type="button"
                    className="btn join-item btn-square"
                    onClick={refreshEncoders}
                    disabled={isEncoderLoading}
                    aria-label="Refresh video encoders"
                >
                    {isEncoderLoading
                        ? <span className="loading loading-spinner loading-sm" />
                        : <ArrowPathIcon className="size-5" />}
                </button>
            </div>
        </Fieldset>

        {engineError && <p className="text-sm text-error" role="alert">{engineError}</p>}

        <Fieldset legend="Recording quality" description="Adjust the real encoder preset and resolution-aware bitrate. Performance uses the least CPU and storage bandwidth; Quality keeps more detail.">
            <label className="label" htmlFor="recording-quality">Quality preset</label>
            <select
                id="recording-quality"
                className="select w-full"
                value={quality || "balanced"}
                onChange={onSelectQuality}
                disabled={isPendingQuality || isQualityLoading}
            >
                <option value="performance">Performance — lowest overhead</option>
                <option value="balanced">Balanced — recommended</option>
                <option value="quality">Quality — higher bitrate</option>
            </select>
        </Fieldset>

        <Fieldset legend="Screen recording frame rate" description="30 FPS uses fewer resources. Choose 60 FPS for fast motion when the device has enough headroom.">
            <div className="label">Frame rate</div>
            <div className="join">
                <Button className={`join-item ${fps === 30 ? "btn-info" : ""}`} disabled={isFpsLoading || isPendingFps}
                    onClick={() => onSelectFps(30)}>30 FPS</Button>
                <Button className={`join-item ${fps === 60 ? "btn-info" : ""}`} disabled={isFpsLoading || isPendingFps}
                    onClick={() => onSelectFps(60)}>60 FPS</Button>
            </div>
        </Fieldset>
    </div>)
}
