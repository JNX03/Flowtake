import { useCallback, useEffect, useRef, useState } from "react"
import TitleBar from "../../components/TitleBar"
import {
    MagnifyingGlassMinusIcon,
    MagnifyingGlassPlusIcon,
    ArrowPathIcon,
    MicrophoneIcon,
    PlayIcon,
    PencilSquareIcon,
    ChevronLeftIcon,
} from "@heroicons/react/16/solid"

const FONT_SIZES = [16, 20, 26, 34, 44]

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition

function normalize(word) {
    return word.toLowerCase().replace(/[^a-z0-9']/g, "")
}

function wordsMatch(spoken, script) {
    if (!spoken || !script) return false
    if (spoken === script) return true
    if (script.length > 4 && spoken.length > 3) {
        if (script.startsWith(spoken) || spoken.startsWith(script)) return true
    }
    if (Math.abs(spoken.length - script.length) <= 1 && spoken.length >= 3) {
        let diffs = 0
        const maxLen = Math.max(spoken.length, script.length)
        for (let i = 0; i < maxLen; i++) {
            if (spoken[i] !== script[i]) diffs++
            if (diffs > 1) return false
        }
        return true
    }
    return false
}

function tokenize(text) {
    const tokens = []
    const regex = /(\S+)([\s]*)/g
    let match
    while ((match = regex.exec(text)) !== null) {
        tokens.push({ word: match[1], trailing: match[2] })
    }
    return tokens
}

export default function App() {
    const [text, setText] = useState("")
    const [mode, setMode] = useState("write") // "write" | "present"
    const [fontSize, setFontSize] = useState(2)
    const [isRecording, setIsRecording] = useState(false)
    const [isFollowing, setIsFollowing] = useState(false)
    const [cursor, setCursor] = useState(0)
    const [interimCursor, setInterimCursor] = useState(0)
    const [isMirrored, setIsMirrored] = useState(false)
    const [hasSpeechSupport] = useState(() => !!SpeechRecognition)
    const [isDictating, setIsDictating] = useState(false)
    const [interimText, setInterimText] = useState("")
    const [elapsed, setElapsed] = useState(0)
    const [controlsVisible, setControlsVisible] = useState(true)

    const scrollRef = useRef(null)
    const recognitionRef = useRef(null)
    const timerRef = useRef(null)
    const cursorRef = useRef(0)
    const currentWordRef = useRef(null)
    const tokensRef = useRef([])
    const controlsTimerRef = useRef(null)
    const textareaRef = useRef(null)

    const tokens = tokenize(text)
    tokensRef.current = tokens

    useEffect(() => { cursorRef.current = cursor }, [cursor])

    // Recording events
    useEffect(() => {
        const onStarted = () => {
            setIsRecording(true)
            setElapsed(0)
            const start = Date.now()
            timerRef.current = setInterval(() => setElapsed(Date.now() - start), 1000)
        }
        const onStopped = () => {
            setIsRecording(false)
            clearInterval(timerRef.current)
        }
        window.electron.ipcRenderer.on('recording-started', onStarted)
        window.electron.ipcRenderer.on('recording-stopped', onStopped)
        window.electron.ipcRenderer.on('recording-canceled', onStopped)
        return () => clearInterval(timerRef.current)
    }, [])

    // Auto-scroll current word into view (top third)
    useEffect(() => {
        if (mode !== "present" || !currentWordRef.current || !scrollRef.current) return
        const container = scrollRef.current
        const el = currentWordRef.current
        const elRect = el.getBoundingClientRect()
        const containerRect = container.getBoundingClientRect()
        const targetOffset = containerRect.height * 0.3
        const currentOffset = elRect.top - containerRect.top
        if (Math.abs(currentOffset - targetOffset) > 40) {
            container.scrollTo({ top: container.scrollTop + (currentOffset - targetOffset), behavior: "smooth" })
        }
    }, [cursor, interimCursor, mode])

    // Auto-hide controls in present mode after inactivity
    const resetControlsTimer = useCallback(() => {
        setControlsVisible(true)
        clearTimeout(controlsTimerRef.current)
        controlsTimerRef.current = setTimeout(() => setControlsVisible(false), 2500)
    }, [])

    useEffect(() => {
        if (mode === "present") {
            resetControlsTimer()
        } else {
            clearTimeout(controlsTimerRef.current)
            setControlsVisible(true)
        }
        return () => clearTimeout(controlsTimerRef.current)
    }, [mode, resetControlsTimer])

    // Keyboard shortcuts in present mode
    useEffect(() => {
        if (mode !== "present") return
        const handler = (e) => {
            resetControlsTimer()
            if (e.key === "Escape") {
                stopRecognition()
                setMode("write")
            } else if (e.key === " " && !e.repeat) {
                e.preventDefault()
                if (isFollowing) stopRecognition()
                else startFollowing()
            } else if (e.key === "r" || e.key === "R") {
                setCursor(0)
                setInterimCursor(0)
                if (scrollRef.current) scrollRef.current.scrollTop = 0
            }
        }
        window.addEventListener("keydown", handler)
        return () => window.removeEventListener("keydown", handler)
    }, [mode, isFollowing, resetControlsTimer])

    const matchSpokenWords = useCallback((spokenText, isFinal) => {
        const spokenWords = spokenText.trim().split(/\s+/).map(normalize).filter(Boolean)
        if (spokenWords.length === 0) return
        const scriptNorm = tokensRef.current.map(t => normalize(t.word))
        let pos = cursorRef.current
        for (const spoken of spokenWords) {
            const lookAhead = Math.min(pos + 5, scriptNorm.length)
            let matched = false
            for (let j = pos; j < lookAhead; j++) {
                if (wordsMatch(spoken, scriptNorm[j])) {
                    pos = j + 1
                    matched = true
                    break
                }
            }
            if (!matched) continue
        }
        if (isFinal && pos > cursorRef.current) {
            setCursor(pos)
            setInterimCursor(pos)
        } else if (!isFinal && pos > cursorRef.current) {
            setInterimCursor(pos)
        }
    }, [])

    const startFollowing = useCallback(() => {
        if (!hasSpeechSupport) return
        const recognition = new SpeechRecognition()
        recognition.continuous = true
        recognition.interimResults = true
        recognition.lang = "en-US"
        recognition.onresult = (event) => {
            let finalTranscript = ""
            let interim = ""
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript
                if (event.results[i].isFinal) finalTranscript += transcript
                else interim += transcript
            }
            if (finalTranscript) matchSpokenWords(finalTranscript, true)
            if (interim) matchSpokenWords(interim, false)
        }
        recognition.onerror = (event) => {
            if (event.error !== "no-speech") console.warn("Speech recognition error:", event.error)
        }
        recognition.onend = () => {
            if (recognitionRef.current) {
                try { recognitionRef.current.start() } catch (e) { /* already started */ }
            }
        }
        recognitionRef.current = recognition
        recognition.start()
        setIsFollowing(true)
    }, [hasSpeechSupport, matchSpokenWords])

    const startDictating = useCallback(() => {
        if (!hasSpeechSupport) return
        const recognition = new SpeechRecognition()
        recognition.continuous = true
        recognition.interimResults = true
        recognition.lang = "en-US"
        recognition.onresult = (event) => {
            let finalTranscript = ""
            let interim = ""
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript
                if (event.results[i].isFinal) finalTranscript += transcript
                else interim += transcript
            }
            if (finalTranscript) {
                setText(prev => {
                    const sep = prev && !prev.endsWith("\n") && !prev.endsWith(" ") ? " " : ""
                    return prev + sep + finalTranscript
                })
            }
            setInterimText(interim)
        }
        recognition.onerror = (event) => {
            if (event.error !== "no-speech") console.warn("Speech error:", event.error)
        }
        recognition.onend = () => {
            if (recognitionRef.current) {
                try { recognitionRef.current.start() } catch (e) { /* */ }
            }
        }
        recognitionRef.current = recognition
        recognition.start()
        setIsDictating(true)
    }, [hasSpeechSupport])

    const stopRecognition = useCallback(() => {
        if (recognitionRef.current) {
            const ref = recognitionRef.current
            recognitionRef.current = null
            ref.stop()
        }
        setIsFollowing(false)
        setIsDictating(false)
        setInterimText("")
    }, [])

    useEffect(() => () => stopRecognition(), [stopRecognition])

    const goToPresent = () => {
        stopRecognition()
        setMode("present")
        setCursor(0)
        setInterimCursor(0)
        if (scrollRef.current) scrollRef.current.scrollTop = 0
    }

    const goToWrite = () => {
        stopRecognition()
        setMode("write")
    }

    const resetProgress = () => {
        setCursor(0)
        setInterimCursor(0)
        if (scrollRef.current) scrollRef.current.scrollTop = 0
    }

    const formatTime = (ms) => {
        const s = Math.floor(ms / 1000)
        const m = Math.floor(s / 60)
        const h = Math.floor(m / 60)
        const pad = (n) => String(n).padStart(2, "0")
        if (h > 0) return `${pad(h)}:${pad(m % 60)}:${pad(s % 60)}`
        return `${pad(m)}:${pad(s % 60)}`
    }

    const visualCursor = Math.max(cursor, interimCursor)
    const progress = tokens.length > 0 ? Math.round((cursor / tokens.length) * 100) : 0
    const wordCount = text.split(/\s+/).filter(Boolean).length

    const renderScript = () => {
        if (tokens.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center h-full gap-3 px-6">
                    <p className="text-center opacity-25 text-sm">
                        No script yet.
                    </p>
                    <button
                        className="btn btn-sm btn-ghost opacity-40"
                        onClick={goToWrite}>
                        <ChevronLeftIcon className="size-4" />
                        Write script
                    </button>
                </div>
            )
        }

        return (
            <p
                className="leading-loose whitespace-pre-wrap break-words select-none"
                style={{ fontSize: FONT_SIZES[fontSize] + 4 }}>
                {tokens.map((token, i) => {
                    let className = ""
                    let ref = undefined

                    if (i < cursor) {
                        className = "opacity-20 transition-all duration-300"
                    } else if (i < visualCursor) {
                        className = "text-accent/50 transition-all duration-150"
                    } else if (i === visualCursor) {
                        className = "text-accent font-semibold transition-all duration-150"
                        ref = currentWordRef
                    } else {
                        className = "transition-colors duration-300"
                    }

                    return (
                        <span key={i} ref={ref} className={className}>
                            {token.word}{token.trailing}
                        </span>
                    )
                })}
            </p>
        )
    }

    return (
        <div className="flex flex-col h-full w-full overflow-hidden">
            {/* ── TITLE BAR ── */}
            <TitleBar title="Teleprompter">
                {/* Font controls always visible */}
                <span className="join">
                    <button
                        className="btn btn-xs join-item"
                        onClick={() => setFontSize(Math.max(fontSize - 1, 0))}
                        disabled={fontSize === 0}
                        title="Smaller text">
                        <MagnifyingGlassMinusIcon className="size-3.5" />
                    </button>
                    <button
                        className="btn btn-xs join-item"
                        onClick={() => setFontSize(Math.min(fontSize + 1, FONT_SIZES.length - 1))}
                        disabled={fontSize === FONT_SIZES.length - 1}
                        title="Larger text">
                        <MagnifyingGlassPlusIcon className="size-3.5" />
                    </button>
                </span>

                {/* Mirror toggle (present mode) */}
                {mode === "present" && (
                    <button
                        className={`btn btn-xs ${isMirrored ? "btn-secondary" : "btn-ghost"}`}
                        onClick={() => setIsMirrored(!isMirrored)}
                        title="Mirror text (for autocue)">
                        <span className="font-bold" style={{ transform: "scaleX(-1)", display: "inline-block" }}>M</span>
                    </button>
                )}

                {/* Recording indicator */}
                {isRecording && (
                    <div className="flex items-center gap-1 mr-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                        <span className="text-xs font-mono text-red-400">{formatTime(elapsed)}</span>
                    </div>
                )}
            </TitleBar>

            {/* ── WRITE MODE ── */}
            {mode === "write" && (
                <div className="flex flex-col flex-1 min-h-0 p-3 gap-2 mt-8">
                    {/* Editor area */}
                    <div className="relative flex-1 min-h-0">
                        <textarea
                            ref={textareaRef}
                            className="w-full h-full textarea bg-base-200/50 border border-base-content/10 resize-none leading-relaxed focus:outline-none focus:border-accent/40 rounded-xl p-4 transition-colors"
                            style={{ fontSize: FONT_SIZES[fontSize] }}
                            placeholder="Write your script here..."
                            value={text}
                            onChange={e => setText(e.target.value)}
                            spellCheck
                        />
                        {/* Interim dictation preview */}
                        {isDictating && interimText && (
                            <div className="absolute bottom-2 left-4 right-4 text-xs text-accent opacity-60 truncate pointer-events-none">
                                {interimText}
                            </div>
                        )}
                    </div>

                    {/* Empty state hints */}
                    {!text && (
                        <div className="flex flex-col gap-1 px-1">
                            <p className="text-xs opacity-30">This window is hidden from your recording.</p>
                            <p className="text-xs opacity-30">Write your script, then press Present.</p>
                        </div>
                    )}

                    {/* Bottom bar */}
                    <div className="flex items-center gap-2">
                        {hasSpeechSupport && (
                            <button
                                className={`btn btn-sm ${isDictating ? "btn-error" : "btn-ghost"}`}
                                onClick={isDictating ? stopRecognition : startDictating}
                                title={isDictating ? "Stop dictation" : "Dictate with mic"}>
                                <MicrophoneIcon className="size-4" />
                                <span className="text-xs">{isDictating ? "Stop" : "Dictate"}</span>
                            </button>
                        )}
                        <span className="flex-1 text-xs text-right opacity-40 font-mono">
                            {wordCount > 0 ? `${wordCount} words` : ""}
                        </span>
                        <button
                            className="btn btn-sm btn-accent gap-1.5"
                            onClick={goToPresent}
                            disabled={!text.trim()}>
                            <PlayIcon className="size-4" />
                            Present
                        </button>
                    </div>
                </div>
            )}

            {/* ── PRESENT MODE ── */}
            {mode === "present" && (
                <div
                    className="flex flex-col flex-1 min-h-0 mt-8"
                    onMouseMove={resetControlsTimer}
                    onClick={resetControlsTimer}>

                    {/* Script scroll area */}
                    <div className="relative flex-1 min-h-0">
                        {/* Fade top */}
                        <div
                            className="absolute top-0 left-0 right-0 h-16 z-10 pointer-events-none"
                            style={{ background: "linear-gradient(to bottom, var(--color-base-300, #1d232a), transparent)" }}
                        />
                        {/* Fade bottom */}
                        <div
                            className="absolute bottom-0 left-0 right-0 h-16 z-10 pointer-events-none"
                            style={{ background: "linear-gradient(to top, var(--color-base-300, #1d232a), transparent)" }}
                        />

                        <div
                            ref={scrollRef}
                            className="h-full overflow-y-auto px-6 py-16 scrollbar-hide"
                            style={{ transform: isMirrored ? "scaleX(-1)" : "none" }}>
                            {renderScript()}
                        </div>
                    </div>

                    {/* Progress bar */}
                    {tokens.length > 0 && (
                        <div className="h-0.5 bg-base-content/10 flex-none">
                            <div
                                className="h-full bg-accent transition-all duration-500 ease-out"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    )}

                    {/* Controls bar — auto-hides after inactivity */}
                    <div
                        className={`flex items-center gap-2 px-3 py-2 border-t border-base-content/10 bg-base-200/60 backdrop-blur-sm flex-none transition-all duration-300 ${controlsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none"}`}>

                        {/* Back to write */}
                        <button
                            className="btn btn-xs btn-ghost opacity-60"
                            onClick={goToWrite}
                            title="Back to editor (Esc)">
                            <ChevronLeftIcon className="size-3.5" />
                            <PencilSquareIcon className="size-3.5" />
                        </button>

                        <div className="w-px h-4 bg-base-content/20" />

                        {/* Follow button */}
                        {hasSpeechSupport && (
                            <button
                                className={`btn btn-sm ${isFollowing ? "btn-error" : "btn-accent"}`}
                                onClick={isFollowing ? stopRecognition : startFollowing}
                                title={isFollowing ? "Stop following (Space)" : "Follow voice (Space)"}>
                                <MicrophoneIcon className="size-4" />
                                <span className="text-xs">{isFollowing ? "Stop" : "Follow"}</span>
                            </button>
                        )}

                        {/* Reset */}
                        <button
                            className="btn btn-sm btn-ghost"
                            onClick={resetProgress}
                            title="Reset to start (R)">
                            <ArrowPathIcon className="size-4" />
                        </button>

                        <div className="flex-1" />

                        {/* Progress */}
                        {tokens.length > 0 && (
                            <span className="text-xs font-mono opacity-40">{progress}%</span>
                        )}

                        {/* Keyboard hints */}
                        <span className="text-xs opacity-20 font-mono hidden sm:block">
                            Esc · Space · R
                        </span>
                    </div>
                </div>
            )}
        </div>
    )
}
