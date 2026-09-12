import { useQuery } from "@tanstack/react-query"
import { useEffect, useMemo, useState } from "react"
import {
    PERFORMANCE_MODE_AUTO,
    arePerformanceSignalsEquivalent,
    normalizePerformanceMode,
    readPerformanceSignals,
    resolveCapturePerformanceProfile,
    resolvePerformanceProfile,
} from "./adaptivePerformance"

export const PERFORMANCE_MODE_QUERY_KEY = Object.freeze(["performanceMode"])
export const SYSTEM_INFO_QUERY_KEY = Object.freeze(["systemInfo"])

export default function useAdaptivePerformanceProfile() {
    const { data: storedMode, isPending: isPendingMode } = useQuery({
        queryKey: PERFORMANCE_MODE_QUERY_KEY,
        queryFn: () => window.electron.ipcRenderer.invoke("store-get", "performanceMode"),
        staleTime: Infinity,
    })
    const { data: systemInfo, isPending: isPendingSystemInfo } = useQuery({
        queryKey: SYSTEM_INFO_QUERY_KEY,
        queryFn: () => window.electron.ipcRenderer.invoke("get-system-info"),
        staleTime: Infinity,
    })

    const [signals, setSignals] = useState(() => readPerformanceSignals())

    useEffect(() => {
        const runtimeWindow = globalThis.window
        const runtimeNavigator = globalThis.navigator
        const reducedMotionQuery = runtimeWindow?.matchMedia?.("(prefers-reduced-motion: reduce)")
        const connection = runtimeNavigator?.connection
            || runtimeNavigator?.mozConnection
            || runtimeNavigator?.webkitConnection

        const refreshSignals = () => {
            const nextSignals = readPerformanceSignals(systemInfo)
            setSignals(currentSignals => arePerformanceSignalsEquivalent(currentSignals, nextSignals)
                ? currentSignals
                : nextSignals)
        }

        refreshSignals()
        runtimeWindow?.addEventListener?.("resize", refreshSignals, { passive: true })
        reducedMotionQuery?.addEventListener?.("change", refreshSignals)
        connection?.addEventListener?.("change", refreshSignals)

        return () => {
            runtimeWindow?.removeEventListener?.("resize", refreshSignals)
            reducedMotionQuery?.removeEventListener?.("change", refreshSignals)
            connection?.removeEventListener?.("change", refreshSignals)
        }
    }, [systemInfo])

    const mode = normalizePerformanceMode(storedMode || PERFORMANCE_MODE_AUTO)
    const profile = useMemo(() => resolvePerformanceProfile(mode, signals), [mode, signals])
    const captureProfile = useMemo(() => resolveCapturePerformanceProfile(mode, signals), [mode, signals])

    return {
        mode,
        profile,
        captureProfile,
        signals,
        isPending: isPendingMode || isPendingSystemInfo,
    }
}
