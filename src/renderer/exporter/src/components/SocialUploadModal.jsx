import {
    ArrowTopRightOnSquareIcon,
    CheckCircleIcon,
    ClipboardDocumentIcon,
    ExclamationTriangleIcon,
    LinkIcon,
    XMarkIcon
} from "@heroicons/react/24/outline"
import { CloudArrowUpIcon } from "@heroicons/react/24/solid"
import PropTypes from "prop-types"
import {
    useCallback,
    useEffect,
    useRef,
    useState
} from "react"

const PRIVACY_OPTIONS = [
    { value: "private", label: "Private", desc: "Only you can watch" },
    { value: "unlisted", label: "Unlisted", desc: "Anyone with the link can watch" },
    { value: "public", label: "Public", desc: "Everyone can watch" },
]

const YOUTUBE_ICON = (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-5">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
)

export default function SocialUploadModal({ renderId, videoName, isOpen, onClose }) {
    const dialogRef = useRef(null)

    // State
    const [step, setStep] = useState("loading") // loading, setup, connect, form, uploading, done
    const [authStatus, setAuthStatus] = useState(null)
    const [isConnecting, setIsConnecting] = useState(false)

    // Credentials form
    const [clientId, setClientId] = useState("")
    const [clientSecret, setClientSecret] = useState("")
    const [savingCreds, setSavingCreds] = useState(false)

    // Upload form
    const [title, setTitle] = useState("")
    const [description, setDescription] = useState("")
    const [privacy, setPrivacy] = useState("unlisted")

    // Upload state
    const [uploadProgress, setUploadProgress] = useState(0)
    const [uploadResult, setUploadResult] = useState(null)
    const [error, setError] = useState(null)
    const [copied, setCopied] = useState(false)

    const checkAuthStatus = useCallback(async () => {
        try {
            const status = await window.electron.ipcRenderer.invoke("youtube-auth-status")
            setAuthStatus(status)
            if (!status.hasCredentials) {
                setStep("setup")
            } else if (!status.connected) {
                setStep("connect")
            } else {
                setStep("form")
            }
        } catch (e) {
            console.error("Failed to check YouTube auth:", e)
            setStep("setup")
        }
    }, [])

    // Initialize on open
    useEffect(() => {
        if (isOpen) {
            dialogRef.current?.showModal()
            setTitle(videoName || "")
            setDescription("")
            setPrivacy("unlisted")
            setUploadProgress(0)
            setUploadResult(null)
            setError(null)
            setCopied(false)
            setIsConnecting(false)
            checkAuthStatus()
        } else {
            dialogRef.current?.close()
        }
    }, [isOpen, videoName, checkAuthStatus])

    // Listen for YouTube auth events
    useEffect(() => {
        const onAuthSuccess = () => {
            setIsConnecting(false)
            checkAuthStatus()
        }
        const onAuthError = (_e, err) => {
            setIsConnecting(false)
            setError(typeof err === "string" ? err : "Authentication failed")
        }

        window.electron.ipcRenderer.on("youtube-auth-success", onAuthSuccess)
        window.electron.ipcRenderer.on("youtube-auth-error", onAuthError)

        return () => {
            window.electron.ipcRenderer.removeListener("youtube-auth-success", onAuthSuccess)
            window.electron.ipcRenderer.removeListener("youtube-auth-error", onAuthError)
        }
    }, [checkAuthStatus])

    // Listen for upload progress
    useEffect(() => {
        const onProgress = (_e, data) => {
            if (data.renderId === renderId) {
                setUploadProgress(data.progress || 0)
                if (data.status === "completed") {
                    setUploadResult(data)
                    setStep("done")
                } else if (data.status === "error") {
                    setError(data.error)
                    setStep("form")
                }
            }
        }

        window.electron.ipcRenderer.on("youtube-upload-progress", onProgress)
        return () => {
            window.electron.ipcRenderer.removeListener("youtube-upload-progress", onProgress)
        }
    }, [renderId])

    const handleSaveCredentials = async () => {
        if (!clientId.trim() || !clientSecret.trim()) return
        setSavingCreds(true)
        setError(null)
        try {
            await window.electron.ipcRenderer.invoke("youtube-set-credentials", clientId.trim(), clientSecret.trim())
            checkAuthStatus()
        } catch (e) {
            setError(e.message || "Failed to save credentials")
        } finally {
            setSavingCreds(false)
        }
    }

    const handleConnect = async () => {
        setIsConnecting(true)
        setError(null)
        try {
            await window.electron.ipcRenderer.invoke("youtube-auth-start")
        } catch (e) {
            setError(e.message || "Failed to start authentication")
            setIsConnecting(false)
        }
    }

    const handleDisconnect = async () => {
        await window.electron.ipcRenderer.invoke("youtube-auth-disconnect")
        setAuthStatus({ ...authStatus, connected: false, channelName: null })
        setStep("connect")
    }

    const handleUpload = async () => {
        if (!title.trim()) return
        setError(null)
        setStep("uploading")
        setUploadProgress(0)
        try {
            const result = await window.electron.ipcRenderer.invoke(
                "youtube-upload-video", renderId, title.trim(), description.trim(), privacy
            )
            setUploadResult(result)
            setStep("done")
        } catch (e) {
            setError(e.message || "Upload failed")
            setStep("form")
        }
    }

    const handleCopyUrl = async () => {
        if (uploadResult?.videoUrl) {
            await navigator.clipboard.writeText(uploadResult.videoUrl)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        }
    }

    const handleOpenVideo = () => {
        if (uploadResult?.videoUrl) {
            window.electron.ipcRenderer.invoke("open-url-in-browser", uploadResult.videoUrl)
        }
    }

    return (
        <dialog ref={dialogRef} className="modal" onClose={onClose}>
            <div className="modal-box max-w-md p-0 bg-base-300 overflow-hidden rounded-xl border border-base-content/10">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-base-content/5">
                    <div className="flex items-center gap-2">
                        <span className="text-red-500">{YOUTUBE_ICON}</span>
                        <h3 className="text-sm font-semibold">Upload to YouTube</h3>
                    </div>
                    <button
                        className="opacity-40 hover:opacity-70 transition-all p-1"
                        onClick={onClose}
                    >
                        <XMarkIcon className="size-4" />
                    </button>
                </div>

                <div className="p-4">
                    {/* Error banner */}
                    {error && (
                        <div className="flex items-start gap-2 p-3 rounded-lg bg-error/10 text-error mb-4">
                            <ExclamationTriangleIcon className="size-4 flex-none mt-0.5" />
                            <p className="text-[11px] leading-relaxed">{error}</p>
                        </div>
                    )}

                    {/* Loading */}
                    {step === "loading" && (
                        <div className="flex items-center justify-center py-8">
                            <span className="loading loading-spinner loading-md opacity-40" />
                        </div>
                    )}

                    {/* Step: Setup credentials */}
                    {step === "setup" && (
                        <div className="flex flex-col gap-4">
                            <div className="bg-base-100 rounded-lg p-3">
                                <p className="text-[11px] opacity-50 leading-relaxed">
                                    To upload directly to YouTube, you need Google Cloud API credentials.
                                    Create a project at{" "}
                                    <button
                                        className="text-primary hover:underline"
                                        onClick={() => window.electron.ipcRenderer.invoke("open-url-in-browser", "https://console.cloud.google.com/apis/credentials")}
                                    >
                                        Google Cloud Console
                                    </button>
                                    , enable the YouTube Data API v3, and create an OAuth 2.0 Client ID (Desktop app type).
                                    Set the redirect URI to <code className="text-[10px] bg-base-300 px-1 py-0.5 rounded">http://127.0.0.1:48721</code>.
                                </p>
                            </div>
                            <div>
                                <label className="text-[11px] font-medium opacity-50 mb-1.5 block">Client ID</label>
                                <input
                                    type="text"
                                    value={clientId}
                                    onChange={e => setClientId(e.target.value)}
                                    placeholder="123456789-abc.apps.googleusercontent.com"
                                    className="input input-sm w-full bg-base-100 border-0 text-xs rounded-lg"
                                />
                            </div>
                            <div>
                                <label className="text-[11px] font-medium opacity-50 mb-1.5 block">Client Secret</label>
                                <input
                                    type="password"
                                    value={clientSecret}
                                    onChange={e => setClientSecret(e.target.value)}
                                    placeholder="GOCSPX-..."
                                    className="input input-sm w-full bg-base-100 border-0 text-xs rounded-lg"
                                />
                            </div>
                            <button
                                onClick={handleSaveCredentials}
                                disabled={!clientId.trim() || !clientSecret.trim() || savingCreds}
                                className="btn btn-sm btn-primary w-full text-xs rounded-lg"
                            >
                                {savingCreds ? <span className="loading loading-spinner loading-xs" /> : "Save & Continue"}
                            </button>
                        </div>
                    )}

                    {/* Step: Connect YouTube account */}
                    {step === "connect" && (
                        <div className="flex flex-col items-center gap-4 py-4">
                            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center text-red-500">
                                {YOUTUBE_ICON}
                            </div>
                            <div className="text-center">
                                <p className="text-xs font-medium">Connect your YouTube account</p>
                                <p className="text-[11px] opacity-40 mt-1">
                                    Sign in with Google to upload videos directly.
                                </p>
                            </div>
                            <button
                                onClick={handleConnect}
                                disabled={isConnecting}
                                className="btn btn-sm bg-red-600 hover:bg-red-700 text-white border-0 w-full text-xs rounded-lg"
                            >
                                {isConnecting ? (
                                    <>
                                        <span className="loading loading-spinner loading-xs" />
                                        Waiting for sign-in...
                                    </>
                                ) : (
                                    <>
                                        {YOUTUBE_ICON}
                                        Sign in with Google
                                    </>
                                )}
                            </button>
                            {isConnecting && (
                                <p className="text-[10px] opacity-30 text-center">
                                    A browser window has opened. Complete the sign-in there.
                                </p>
                            )}
                            <button
                                onClick={() => setStep("setup")}
                                className="text-[11px] opacity-30 hover:opacity-50 transition-all"
                            >
                                Change API credentials
                            </button>
                        </div>
                    )}

                    {/* Step: Upload form */}
                    {step === "form" && (
                        <div className="flex flex-col gap-4">
                            {/* Connected account */}
                            {authStatus?.channelName && (
                                <div className="flex items-center justify-between bg-base-100 rounded-lg px-3 py-2">
                                    <div className="flex items-center gap-2">
                                        <CheckCircleIcon className="size-4 text-success" />
                                        <span className="text-[11px] font-medium">{authStatus.channelName}</span>
                                    </div>
                                    <button
                                        onClick={handleDisconnect}
                                        className="text-[10px] opacity-30 hover:opacity-60 hover:text-error transition-all"
                                    >
                                        Disconnect
                                    </button>
                                </div>
                            )}

                            <div>
                                <label className="text-[11px] font-medium opacity-50 mb-1.5 block">Title *</label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    maxLength={100}
                                    className="input input-sm w-full bg-base-100 border-0 text-xs rounded-lg"
                                />
                            </div>

                            <div>
                                <label className="text-[11px] font-medium opacity-50 mb-1.5 block">Description</label>
                                <textarea
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    rows={3}
                                    maxLength={5000}
                                    placeholder="Optional description..."
                                    className="textarea textarea-sm w-full bg-base-100 border-0 text-xs rounded-lg resize-none leading-relaxed"
                                />
                            </div>

                            <div>
                                <label className="text-[11px] font-medium opacity-50 mb-1.5 block">Privacy</label>
                                <div className="grid grid-cols-3 gap-1.5">
                                    {PRIVACY_OPTIONS.map(opt => (
                                        <button
                                            key={opt.value}
                                            onClick={() => setPrivacy(opt.value)}
                                            className={`py-2 rounded-lg text-xs font-medium transition-all ${
                                                privacy === opt.value
                                                    ? "bg-primary text-primary-content"
                                                    : "bg-base-100 text-base-content/60 hover:text-base-content hover:bg-base-100/80"
                                            }`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                                <p className="text-[10px] opacity-30 mt-1.5">
                                    {PRIVACY_OPTIONS.find(o => o.value === privacy)?.desc}
                                </p>
                            </div>

                            <button
                                onClick={handleUpload}
                                disabled={!title.trim()}
                                className="btn btn-sm btn-primary w-full text-xs rounded-lg gap-1.5"
                            >
                                <CloudArrowUpIcon className="size-4" />
                                Upload to YouTube
                            </button>
                        </div>
                    )}

                    {/* Step: Uploading */}
                    {step === "uploading" && (
                        <div className="flex flex-col items-center gap-4 py-6">
                            <div className="relative w-16 h-16">
                                <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                                    <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor"
                                        strokeWidth="4" className="opacity-10" />
                                    <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor"
                                        strokeWidth="4" className="text-primary"
                                        strokeDasharray={`${(uploadProgress / 100) * 175.93} 175.93`}
                                        strokeLinecap="round" />
                                </svg>
                                <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold">
                                    {uploadProgress}%
                                </span>
                            </div>
                            <div className="text-center">
                                <p className="text-xs font-medium">Uploading to YouTube...</p>
                                <p className="text-[11px] opacity-40 mt-1">{title}</p>
                            </div>
                            <div className="w-full h-1.5 bg-base-100 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-primary rounded-full transition-all duration-300"
                                    style={{ width: `${uploadProgress}%` }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Step: Done */}
                    {step === "done" && uploadResult && (
                        <div className="flex flex-col items-center gap-4 py-4">
                            <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center">
                                <CheckCircleIcon className="size-7 text-success" />
                            </div>
                            <div className="text-center">
                                <p className="text-xs font-medium">Upload complete!</p>
                                <p className="text-[11px] opacity-40 mt-1">
                                    Your video is being processed by YouTube.
                                </p>
                            </div>

                            {uploadResult.videoUrl && (
                                <div className="w-full bg-base-100 rounded-lg p-3 flex items-center gap-2">
                                    <LinkIcon className="size-3.5 opacity-40 flex-none" />
                                    <span className="text-[11px] text-primary truncate flex-1">
                                        {uploadResult.videoUrl}
                                    </span>
                                    <button
                                        onClick={handleCopyUrl}
                                        className="opacity-40 hover:opacity-70 transition-all flex-none"
                                        title="Copy URL"
                                    >
                                        <ClipboardDocumentIcon className="size-3.5" />
                                    </button>
                                </div>
                            )}
                            {copied && (
                                <span className="text-[10px] text-success -mt-2">Copied to clipboard!</span>
                            )}

                            <div className="flex gap-2 w-full">
                                <button
                                    onClick={handleOpenVideo}
                                    className="btn btn-sm flex-1 bg-red-600 hover:bg-red-700 text-white border-0 text-xs rounded-lg gap-1.5"
                                >
                                    <ArrowTopRightOnSquareIcon className="size-3.5" />
                                    Open on YouTube
                                </button>
                                <button
                                    onClick={onClose}
                                    className="btn btn-sm flex-1 bg-base-100 border-0 text-xs rounded-lg"
                                >
                                    Done
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            <form method="dialog" className="modal-backdrop">
                <button onClick={onClose}>close</button>
            </form>
        </dialog>
    )
}

SocialUploadModal.propTypes = {
    renderId: PropTypes.string,
    videoName: PropTypes.string,
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
}
