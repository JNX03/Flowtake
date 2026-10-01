import { useQuery } from "@tanstack/react-query"
import { useSelector } from "react-redux"
import { selectCapturers, selectEncoders } from "../redux/appSlice"
import { getRecorderReadiness } from "../recorderReadiness"

export default function useRecorderReadiness() {
    const capturers = useSelector(selectCapturers)
    const encoders = useSelector(selectEncoders)
    const permissionQuery = useQuery({
        queryKey: ["permissions"],
        queryFn: () => window.electron.ipcRenderer.invoke("check-permissions"),
        staleTime: 30000, refetchOnWindowFocus: "always", retry: 1,
    })
    const dependencyQuery = useQuery({
        queryKey: ["setup-dependencies"],
        queryFn: () => window.electron.ipcRenderer.invoke("check-dependencies"),
        staleTime: 30000, retry: 1,
    })
    const { data: version } = useQuery({
        queryKey: ["version"],
        queryFn: () => window.electron.ipcRenderer.invoke("get-version"),
        staleTime: Infinity,
    })
    const platform = window.electron?.process?.platform ?? "unknown"
    const permissions = Array.isArray(permissionQuery.data) ? permissionQuery.data : undefined
    const rawDependencies = dependencyQuery.data?.dependencies ?? dependencyQuery.data
    const dependencies = Array.isArray(rawDependencies) ? rawDependencies : undefined
    const isLoading = permissionQuery.isFetching || dependencyQuery.isFetching
    const isError = permissionQuery.isError || dependencyQuery.isError
    const hasEngines = capturers.length > 0 && encoders.length > 0
    const refresh = () => Promise.all([permissionQuery.refetch(), dependencyQuery.refetch()])
    return {
        permissions, dependencies, platform, version, isLoading, isError, hasEngines, refresh,
        installCommand: dependencyQuery.data?.installCommand ?? "",
        ...getRecorderReadiness({ permissions, dependencies, isLoading, isError, hasEngines }),
    }
}
