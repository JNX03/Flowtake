import PropTypes from "prop-types"
import {
    forwardRef,
    useEffect,
    useRef,
    useState
} from "react"
import { useSelector } from "react-redux"
import { convertFileSrc } from "@tauri-apps/api/core"
import { selectId } from "../src/redux/projectSlice"

// Map video URL schemes to video types for the get_video_path command
function getVideoType(src) {
    if (src.includes("screen")) return "screen"
    if (src.includes("camera")) return "camera"
    if (src.includes("microphone")) return "microphone"
    return "screen"
}

const Media = forwardRef(({ isVideo, src, title, controls, muted, preload, className, param, onReady, onError }, ref) => {

    const internalRef = useRef(null)
    const projectId = useSelector(selectId)
    const [resolvedSrc, setResolvedSrc] = useState(null)
    const [retryCount, setRetryCount] = useState(0)

    const maxRetries = 3

    // Combine forwarded ref and internal ref
    useEffect(() => {
        if (ref) {
            if (typeof ref === 'function') {
                ref(internalRef.current)
            } else {
                ref.current = internalRef.current
            }
        }
    }, [ref])

    // Resolve the video file path to an asset URL
    useEffect(() => {
        if (!projectId || !src) return

        const videoType = getVideoType(src)
        console.log("[Media] Resolving video path for:", videoType, "projectId:", projectId)

        window.electron.ipcRenderer.invoke("get-video-path", videoType, projectId)
            .then(filePath => {
                if (filePath) {
                    const assetUrl = convertFileSrc(filePath)
                    console.log("[Media] Resolved to asset URL:", assetUrl)
                    setResolvedSrc(assetUrl)
                } else {
                    console.error("[Media] No file path returned for", videoType)
                }
            })
            .catch(err => {
                console.error("[Media] Failed to get video path:", err)
            })
    }, [src, projectId, retryCount])

    useEffect(() => {
        if (resolvedSrc) {
            const video = internalRef.current
            if (!video) return

            let timeoutId
            let canPlayListener

            const handleVideoError = () => {
                const err = video.error
                console.error("[Media] Video error:", err?.code, err?.message, "src:", resolvedSrc)
            }
            video.addEventListener('error', handleVideoError)

            const handleCanPlay = () => {
                clearTimeout(timeoutId)
                onReady?.()
            }

            const setupListeners = () => {
                if (canPlayListener) video.removeEventListener('canplay', canPlayListener)
                canPlayListener = () => { handleCanPlay() }
                video.addEventListener('canplay', canPlayListener, { once: true })
            }

            const recoverVideo = () => {
                console.warn(`Video load timeout (attempt ${retryCount + 1}/${maxRetries})`)
                video.pause()
                video.removeAttribute('src')
                video.load()

                const separator = resolvedSrc.includes('?') ? '&' : '?'
                const newSrc = `${resolvedSrc}${separator}t=${Date.now()}`
                video.src = newSrc
                setupListeners()
                setRetryCount(prev => prev + 1)
            }

            if (video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
                handleCanPlay()
                return
            }

            setupListeners()

            timeoutId = setTimeout(() => {
                if (retryCount < maxRetries - 1) {
                    recoverVideo()
                    timeoutId = setTimeout(() => recoverVideo(), 5000)
                } else {
                    console.error('Max retries reached, giving up')
                    onError?.()
                }
            }, 5000)

            return () => {
                clearTimeout(timeoutId)
                if (canPlayListener) video.removeEventListener('canplay', canPlayListener)
                video.removeEventListener('error', handleVideoError)
            }
        }
    }, [retryCount, resolvedSrc, onReady, onError])

    return <>{isVideo
        ? <video
            ref={internalRef}
            src={resolvedSrc || ""}
            title={title}
            controls={controls}
            className={className}
            preload={preload || "auto"}
            muted={muted}
            playsInline
            />
        : <audio
        ref={internalRef}
            src={resolvedSrc || ""}
            title={title}
            controls={controls}
            className={className}
            preload={preload || "auto"}
            muted={muted}
            />}
    </>
})

Media.displayName = "Media"

export default Media

Media.propTypes = {
    isVideo: PropTypes.bool,
    src: PropTypes.string.isRequired,
    title: PropTypes.string,
    controls: PropTypes.bool,
    muted: PropTypes.bool,
    preload: PropTypes.string,
    className: PropTypes.string,
    param: PropTypes.shape({
        title: PropTypes.string,
        value: PropTypes.any
    }),
    onReady: PropTypes.func,
    onError: PropTypes.func
}
