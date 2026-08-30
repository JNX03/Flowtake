import PropTypes from "prop-types"
import {
    forwardRef,
    useEffect,
    useMemo,
    useRef,
    useState
} from "react"
import { useSelector } from "react-redux"
import { selectId } from "../shared/redux/projectSlice"

const Media = forwardRef(({ isVideo, src, title, controls, muted, preload, className, param, isResolved, onReady, onError }, ref) => {

    const internalRef = useRef(null)

    const projectId = useSelector(selectId)

    const [retryCount, setRetryCount] = useState(0)

    const fullSrc = useMemo(
        () => isResolved ? src : `${src}?projectId=${projectId}${param ? `&${param.title}=${param.value}` : ""}`,
        [src, isResolved, param, projectId])

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


    useEffect(() => {
        if (!fullSrc) return

        const video = internalRef.current
        if (!video) return

        let timeoutId = null
        let canPlayListener = null

        const handleVideoError = () => {
            const err = video.error
            if (err?.code === 4 && !video.getAttribute("src")) return
            console.error("[Media] Video error:", err?.code, err?.message, "src:", fullSrc)
        }
        video.addEventListener('error', handleVideoError)

        const handleCanPlay = () => {
            if (timeoutId !== null) clearTimeout(timeoutId)
            onReady?.()
        }

        const setupListeners = () => {
            if (canPlayListener) video.removeEventListener('canplay', canPlayListener)
            canPlayListener = handleCanPlay
            video.addEventListener('canplay', canPlayListener, { once: true })
        }

        const recoverVideo = () => {
            video.pause()
            video.removeAttribute('src')
            video.load()

            const separator = fullSrc.includes('?') ? '&' : '?'
            video.src = `${fullSrc}${separator}t=${Date.now()}&retry=${retryCount}`
            setupListeners()
            setRetryCount(previous => previous + 1)
        }

        if (video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
            handleCanPlay()
        } else {
            setupListeners()
            timeoutId = setTimeout(() => {
                if (retryCount < maxRetries - 1) recoverVideo()
                else onError?.()
            }, 5000)
        }

        return () => {
            if (timeoutId !== null) clearTimeout(timeoutId)
            if (canPlayListener) video.removeEventListener('canplay', canPlayListener)
            video.removeEventListener('error', handleVideoError)
        }
    }, [retryCount, fullSrc, onReady, onError])

    return <>{isVideo
        ? <video
            ref={internalRef}
            src={fullSrc}
            title={title}
            controls={controls}
            className={className}
            preload={preload || "auto"}
            muted={muted}
            crossOrigin="anonymous"
            playsInline
            />
        : <audio
        ref={internalRef}
            src={fullSrc}
            title={title}
            controls={controls}
            className={className}
            preload={preload || "auto"}
            muted={muted}
            crossOrigin="anonymous"
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
    isResolved: PropTypes.bool,
    onReady: PropTypes.func,
    onError: PropTypes.func
}
