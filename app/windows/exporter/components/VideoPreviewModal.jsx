import {
    ArrowTopRightOnSquareIcon,
    CloudArrowUpIcon,
    ClipboardDocumentIcon,
    ShareIcon,
    XMarkIcon
} from "@heroicons/react/24/outline"
import { convertFileSrc } from "@tauri-apps/api/core"
import PropTypes from "prop-types"
import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState
} from "react"
import SocialUploadModal from "./SocialUploadModal"

const SOCIAL_PLATFORMS = [
    {
        name: "YouTube",
        url: "https://www.youtube.com/upload",
        color: "#FF0000",
        icon: (
            <svg viewBox="0 0 24 24" fill="currentColor" className="size-4">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
            </svg>
        )
    },
    {
        name: "Facebook",
        url: "https://www.facebook.com/video",
        color: "#1877F2",
        icon: (
            <svg viewBox="0 0 24 24" fill="currentColor" className="size-4">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
        )
    },
    {
        name: "X",
        url: "https://twitter.com/compose/tweet",
        color: "#000000",
        icon: (
            <svg viewBox="0 0 24 24" fill="currentColor" className="size-4">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
        )
    },
    {
        name: "TikTok",
        url: "https://www.tiktok.com/upload",
        color: "#000000",
        icon: (
            <svg viewBox="0 0 24 24" fill="currentColor" className="size-4">
                <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
            </svg>
        )
    },
    {
        name: "LinkedIn",
        url: "https://www.linkedin.com/feed/",
        color: "#0A66C2",
        icon: (
            <svg viewBox="0 0 24 24" fill="currentColor" className="size-4">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
            </svg>
        )
    },
    {
        name: "Reddit",
        url: "https://www.reddit.com/submit",
        color: "#FF4500",
        icon: (
            <svg viewBox="0 0 24 24" fill="currentColor" className="size-4">
                <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z" />
            </svg>
        )
    }
]

export default function VideoPreviewModal({ renderId, videoName, isOpen, onClose }) {
    const dialogRef = useRef(null)
    const videoRef = useRef(null)
    const [videoSrc, setVideoSrc] = useState(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState(null)
    const [showShareMenu, setShowShareMenu] = useState(false)
    const [copied, setCopied] = useState(false)
    const [showUploadModal, setShowUploadModal] = useState(false)

    const loadVideo = useCallback(async () => {
        if (!renderId || !isOpen) return
        setIsLoading(true)
        setError(null)
        try {
            const filePath = await window.electron.ipcRenderer.invoke("get-render-video-path", renderId)
            if (filePath) {
                const src = convertFileSrc(filePath)
                setVideoSrc(src)
            } else {
                setError("Video file not found")
            }
        } catch (e) {
            console.error("Failed to load video preview:", e)
            setError("Failed to load video")
        } finally {
            setIsLoading(false)
        }
    }, [renderId, isOpen])

    useEffect(() => {
        if (isOpen) {
            loadVideo()
            dialogRef.current?.showModal()
        } else {
            dialogRef.current?.close()
            setVideoSrc(null)
            setShowShareMenu(false)
            setCopied(false)
            if (videoRef.current) {
                videoRef.current.pause()
                videoRef.current.src = ""
            }
        }
    }, [isOpen, loadVideo])

    const handleShare = useCallback((url) => {
        window.electron.ipcRenderer.invoke("open-url-in-browser", url)
    }, [])

    const handleCopyPath = useCallback(async () => {
        try {
            const filePath = await window.electron.ipcRenderer.invoke("get-render-video-path", renderId)
            await navigator.clipboard.writeText(filePath)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch (e) {
            console.error("Failed to copy path:", e)
        }
    }, [renderId])

    const title = useMemo(() => videoName || "Preview", [videoName])

    return (
        <dialog ref={dialogRef} className="modal" onClose={onClose}>
            <div className="modal-box max-w-2xl p-0 bg-base-300 overflow-hidden rounded-xl border border-base-content/10">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-2.5">
                    <h3 className="text-xs font-medium truncate flex-1 mr-2 opacity-70">{title}</h3>
                    <div className="flex items-center gap-1">
                        <button
                            className={`flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-md transition-all ${
                                showShareMenu
                                    ? "bg-primary/10 text-primary"
                                    : "opacity-50 hover:opacity-80"
                            }`}
                            onClick={() => setShowShareMenu(!showShareMenu)}
                        >
                            <ShareIcon className="size-3.5" />
                            Share
                        </button>
                        <button
                            className="opacity-40 hover:opacity-70 transition-all p-1"
                            onClick={onClose}
                        >
                            <XMarkIcon className="size-4" />
                        </button>
                    </div>
                </div>

                {/* Video Player */}
                <div className="bg-black aspect-video flex items-center justify-center">
                    {isLoading && <span className="loading loading-spinner loading-md opacity-40" />}
                    {error && <span className="text-error/70 text-xs">{error}</span>}
                    {!isLoading && !error && videoSrc && (
                        <video
                            ref={videoRef}
                            src={videoSrc}
                            controls
                            autoPlay
                            className="w-full h-full"
                        />
                    )}
                </div>

                {/* Share Panel */}
                {showShareMenu && (
                    <div className="p-4">
                        {/* Direct Upload */}
                        <span className="text-[11px] font-medium uppercase tracking-wider opacity-30 mb-2 block">
                            Direct Upload
                        </span>
                        <button
                            className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg bg-red-600/10 hover:bg-red-600/20 transition-all group mb-4"
                            onClick={() => setShowUploadModal(true)}
                        >
                            <span className="text-red-500">
                                <svg viewBox="0 0 24 24" fill="currentColor" className="size-4">
                                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                                </svg>
                            </span>
                            <span className="text-[11px] font-medium opacity-80 group-hover:opacity-100">Upload to YouTube</span>
                            <CloudArrowUpIcon className="size-3.5 ml-auto opacity-0 group-hover:opacity-50 transition-opacity" />
                        </button>

                        {/* Open in Browser */}
                        <span className="text-[11px] font-medium uppercase tracking-wider opacity-30 mb-2 block">
                            Open in Browser
                        </span>
                        <div className="grid grid-cols-3 gap-1.5">
                            {SOCIAL_PLATFORMS.map(platform => (
                                <button
                                    key={platform.name}
                                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-base-100 hover:bg-base-100/80 transition-all group"
                                    onClick={() => handleShare(platform.url)}
                                >
                                    <span style={{ color: platform.color }} className="opacity-70 group-hover:opacity-100 transition-opacity">
                                        {platform.icon}
                                    </span>
                                    <span className="text-[11px] font-medium opacity-60 group-hover:opacity-80">{platform.name}</span>
                                    <ArrowTopRightOnSquareIcon className="size-3 ml-auto opacity-0 group-hover:opacity-30 transition-opacity" />
                                </button>
                            ))}
                        </div>
                        <button
                            className="flex items-center gap-2 w-full mt-2 px-3 py-2 rounded-lg hover:bg-base-100/50 transition-all"
                            onClick={handleCopyPath}
                        >
                            <ClipboardDocumentIcon className="size-3.5 opacity-40" />
                            <span className="text-[11px] opacity-40">
                                {copied ? "Copied!" : "Copy file path"}
                            </span>
                        </button>
                    </div>
                )}

                {/* YouTube Upload Modal */}
                <SocialUploadModal
                    renderId={renderId}
                    videoName={videoName}
                    isOpen={showUploadModal}
                    onClose={() => setShowUploadModal(false)}
                />
            </div>
            <form method="dialog" className="modal-backdrop">
                <button onClick={onClose}>close</button>
            </form>
        </dialog>
    )
}

VideoPreviewModal.propTypes = {
    renderId: PropTypes.string,
    videoName: PropTypes.string,
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired
}
