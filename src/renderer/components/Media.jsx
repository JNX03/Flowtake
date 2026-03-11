import PropTypes from "prop-types"
import {
    forwardRef,
    useEffect,
    useMemo,
    useRef,
    useState
} from "react"
import { useSelector } from "react-redux"
import { selectId } from "../src/redux/projectSlice"

const Media = forwardRef(({ isVideo, src, title, controls, muted, preload, className, param, onReady, onError }, ref) => {

    const internalRef = useRef(null)
    
    const projectId = useSelector(selectId)

    const [retryCount, setRetryCount] = useState(0)

    const fullSrc = useMemo(
        () => `${src}?projectId=${projectId}${param ? `&${param.title}=${param.value}` : ""}`,
        [src, param, projectId])

    const maxRetries = 3 // Maximum number of retry attempts

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
        if (fullSrc) {
            const video = internalRef.current
            let timeoutId
            let canPlayListener

            const handleCanPlay = () => {
                clearTimeout(timeoutId)
                onReady?.()
            }

            const setupListeners = () => {
                // Clean up previous listener if exists
                if (canPlayListener) video.removeEventListener('canplay', canPlayListener)

                canPlayListener = () => { handleCanPlay() }

                video.addEventListener('canplay', canPlayListener, { once: true })
            }

            const recoverVideo = () => {
                console.warn(`Video load timeout (attempt ${retryCount + 1}/${maxRetries})`)
                
                // 1. Reset the video element
                video.pause()
                video.removeAttribute('src')
                video.load()

                // 2. Force a new request with cache busting and network bypass
                const separator = fullSrc.includes('?') ? '&' : '?'
                const newSrc = `${fullSrc}${separator}t=${Date.now()}&retry=${retryCount}`
                
                // 3. Reapply source and listeners
                video.src = newSrc
                setupListeners()

                setRetryCount(prev => prev + 1)
            }

            // Immediate check if already loaded
            if (video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
                handleCanPlay()
                return
            }

            setupListeners()
            
            // Fallback timeout with retry logic
            timeoutId = setTimeout(() => {
                if (retryCount < maxRetries - 1) {
                    recoverVideo()
                    // Reset timeout for the next attempt
                    timeoutId = setTimeout(() => recoverVideo(), 5000)
                } else {
                    console.error('Max retries reached, giving up')
                    onError?.()
                }
            }, 5000)

            return () => {
                clearTimeout(timeoutId)
                if (canPlayListener) video.removeEventListener('canplay', canPlayListener)
                }
        }
    }, [retryCount, fullSrc, onReady, onError]) // Retry when retryCount changes

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
    onReady: PropTypes.func,
    onError: PropTypes.func
}