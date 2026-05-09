import { useEffect, useMemo, useState } from "react"
import { convertFileSrc } from "@tauri-apps/api/core"
import {
    VIDEO_SCHEME_PREFIX,
    SCREEN_VIDEO,
    CAMERA_VIDEO,
    MICROPHONE_AUDIO
} from "../constants"

const VIDEO_TYPE_MAP = {
    screen: SCREEN_VIDEO,
    camera: CAMERA_VIDEO,
    microphone: MICROPHONE_AUDIO
}

const isWindows = window.electron?.process?.platform === "win32"

export default function useVideoSrc(videoType, projectId) {
    const [assetSrc, setAssetSrc] = useState(null)
    const [isLoading, setIsLoading] = useState(!isWindows)

    // Windows: use existing video:// protocol (works with WebView2)
    const windowsSrc = useMemo(() => {
        if (!isWindows || !projectId) return null
        // Pass through extra-N as-is so the Rust video:// handler can match.
        const type = videoType.startsWith?.("extra-")
            ? videoType
            : (VIDEO_TYPE_MAP[videoType] || SCREEN_VIDEO)
        return `${VIDEO_SCHEME_PREFIX}${type}?projectId=${projectId}`
    }, [videoType, projectId])

    // macOS/Linux: use asset protocol via convertFileSrc
    useEffect(() => {
        if (isWindows || !projectId) return

        let cancelled = false
        setIsLoading(true)

        window.electron.ipcRenderer
            .invoke("get-video-path", videoType, projectId)
            .then(filePath => {
                if (cancelled) return
                if (filePath) {
                    setAssetSrc(convertFileSrc(filePath))
                }
                setIsLoading(false)
            })
            .catch(err => {
                if (cancelled) return
                console.error("[useVideoSrc] Failed to get video path:", err)
                setIsLoading(false)
            })

        return () => { cancelled = true }
    }, [videoType, projectId])

    return {
        src: isWindows ? windowsSrc : assetSrc,
        isLoading
    }
}
