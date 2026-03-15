import { useCallback, useEffect, useRef, useState } from "react"
import TitleBar from "../../components/TitleBar"
import {
    MagnifyingGlassMinusIcon,
    MagnifyingGlassPlusIcon,
    PlayIcon,
    PauseIcon,
    ArrowPathIcon,
    MicrophoneIcon,
    PencilSquareIcon,
    ViewColumnsIcon,
    ChevronUpIcon,
    ChevronDownIcon,
} from "@heroicons/react/16/solid"

const FONT_SIZES = [16, 20, 26, 34, 44]
const SCROLL_SPEEDS = [0.3, 0.6, 1, 1.5, 2.5]
const SPEED_LABELS = ["0.3x", "0.6x", "1x", "1.5x", "2.5x"]

// Speech recognition setup
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition

export default function App() {
    // Core state
    const [text, setText] = useState("")
    const [mode, setMode] = useState("edit") // "edit" | "teleprompter"
    const [fontSize, setFontSize] = useState(2)
    const [isRecording, setIsRecording] = useState(false)

    // Teleprompter state
    const [isScrolling, setIsScrolling] = useState(false)
    const [scrollSpeed, setScrollSpeed] = useState(2) // index into SCROLL_SPEEDS
    const [isMirrored, setIsMirrored] = useState(false)

    // Speech-to-text state
    const [isListening, setIsListening] = useState(false)
    const [interimText, setInterimText] = useState("")
    const [hasSpeechSupport] = useState(() => !!SpeechRecognition)

    // Timer state
    const [elapsed, setElapsed] = useState(0)

    // Refs
    const scrollRef = useRef(null)
    const scrollAnimRef = useRef(null)
    const recognitionRef = useRef(null)
    const timerRef = useRef(null)
    const lastScrollTime = useRef(null)
    const highlightRef = useRef(null)

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
            setIsScrolling(false)
        }
        window.electron.ipcRenderer.on('recording-started', onStarted)
        window.electron.ipcRenderer.on('recording-stopped', onStopped)
        window.electron.ipcRenderer.on('recording-canceled', onStopped)
        return () => {
            clearInterval(timerRef.current)
        }
    }, [])

    // Auto-scroll animation
    useEffect(() => {
        if (!isScrolling || mode !== "teleprompter") {
            cancelAnimationFrame(scrollAnimRef.current)
            lastScrollTime.current = null
            return
        }
        const el = scrollRef.current
        if (!el) return

        const step = (timestamp) => {
            if (lastScrollTime.current !== null) {
                const delta = timestamp - lastScrollTime.current
                const px = SCROLL_SPEEDS[scrollSpeed] * delta * 0.04
                el.scrollTop += px

                // Stop at the bottom
                if (el.scrollTop >= el.scrollHeight - el.clientHeight) {
                    setIsScrolling(false)
                    return
                }
            }
            lastScrollTime.current = timestamp
            scrollAnimRef.current = requestAnimationFrame(step)
        }
        scrollAnimRef.current = requestAnimationFrame(step)
        return () => cancelAnimationFrame(scrollAnimRef.current)
    }, [isScrolling, scrollSpeed, mode])

    // Speech recognition
    const startListening = useCallback(() => {
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
                if (event.results[i].isFinal) {
                    finalTranscript += transcript
                } else {
                    interim += transcript
                }
            }
            if (finalTranscript) {
                setText(prev => {
                    const separator = prev && !prev.endsWith("\n") && !prev.endsWith(" ") ? " " : ""
                    return prev + separator + finalTranscript
                })
            }
            setInterimText(interim)

            // Auto-scroll to bottom when new speech comes in
            if (scrollRef.current) {
                requestAnimationFrame(() => {
                    if (scrollRef.current) {
                        scrollRef.current.scrollTop = scrollRef.current.scrollHeight
                    }
                })
            }
        }

        recognition.onerror = (event) => {
            if (event.error !== "no-speech") {
                console.warn("Speech recognition error:", event.error)
            }
        }

        recognition.onend = () => {
            // Restart if still listening (browser stops after silence)
            if (recognitionRef.current) {
                try { recognitionRef.current.start() } catch (e) { /* already started */ }
            }
        }

        recognitionRef.current = recognition
        recognition.start()
        setIsListening(true)
    }, [hasSpeechSupport])

    const stopListening = useCallback(() => {
        if (recognitionRef.current) {
            const ref = recognitionRef.current
            recognitionRef.current = null
            ref.stop()
        }
        setIsListening(false)
        setInterimText("")
    }, [])

    // Cleanup
    useEffect(() => () => stopListening(), [stopListening])

    const toggleMode = () => {
        if (mode === "edit") {
            setMode("teleprompter")
            // Reset scroll position when entering teleprompter
            if (scrollRef.current) scrollRef.current.scrollTop = 0
        } else {
            setMode("edit")
            setIsScrolling(false)
        }
    }

    const resetScroll = () => {
        if (scrollRef.current) scrollRef.current.scrollTop = 0
        setIsScrolling(false)
    }

    const formatTime = (ms) => {
        const s = Math.floor(ms / 1000)
        const m = Math.floor(s / 60)
        const h = Math.floor(m / 60)
        const pad = (n) => String(n).padStart(2, "0")
        if (h > 0) return `${pad(h)}:${pad(m % 60)}:${pad(s % 60)}`
        return `${pad(m)}:${pad(s % 60)}`
    }

    const displayText = text + (interimText ? (text ? " " : "") + interimText : "")

    return (<>
        <TitleBar title="Teleprompter">
            {/* Font size controls */}
            <span className="join">
                <button className="btn btn-xs join-item"
                    onClick={() => setFontSize(Math.max(fontSize - 1, 0))}
                    disabled={fontSize === 0}
                    title="Decrease font size">
                    <MagnifyingGlassMinusIcon className="size-3.5" />
                </button>
                <button className="btn btn-xs join-item"
                    onClick={() => setFontSize(Math.min(fontSize + 1, FONT_SIZES.length - 1))}
                    disabled={fontSize === FONT_SIZES.length - 1}
                    title="Increase font size">
                    <MagnifyingGlassPlusIcon className="size-3.5" />
                </button>
            </span>

            {/* Mode toggle */}
            <button className={`btn btn-xs ${mode === "teleprompter" ? "btn-primary" : ""}`}
                onClick={toggleMode}
                title={mode === "edit" ? "Switch to teleprompter" : "Switch to edit"}>
                {mode === "edit"
                    ? <ViewColumnsIcon className="size-3.5" />
                    : <PencilSquareIcon className="size-3.5" />
                }
            </button>

            {/* Mirror toggle */}
            {mode === "teleprompter" && (
                <button className={`btn btn-xs ${isMirrored ? "btn-secondary" : ""}`}
                    onClick={() => setIsMirrored(!isMirrored)}
                    title="Mirror text">
                    <span className="text-[10px] font-bold">M</span>
                </button>
            )}
        </TitleBar>

        <div className="flex flex-col h-[calc(100%-2rem)] w-full">
            {/* Edit mode */}
            {mode === "edit" && (
                <div className="flex-1 flex flex-col min-h-0 p-2 gap-2">
                    <textarea
                        ref={scrollRef}
                        className="textarea textarea-bordered flex-1 resize-none leading-relaxed"
                        style={{ fontSize: FONT_SIZES[fontSize] }}
                        placeholder="Type your script here, or use the mic to dictate..."
                        value={text}
                        onChange={e => setText(e.target.value)}
                    />

                    {/* Speech-to-text indicator */}
                    {isListening && interimText && (
                        <div className="text-xs text-accent opacity-70 px-1 truncate">
                            {interimText}
                        </div>
                    )}

                    {/* Bottom toolbar */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                        {hasSpeechSupport && (
                            <button
                                className={`btn btn-sm ${isListening ? "btn-error" : "btn-ghost"}`}
                                onClick={isListening ? stopListening : startListening}
                                title={isListening ? "Stop dictation" : "Start dictation"}>
                                <MicrophoneIcon className="size-4" />
                                <span className="text-xs">{isListening ? "Stop" : "Dictate"}</span>
                            </button>
                        )}
                        <div className="flex-1" />
                        <span className="text-xs opacity-50">
                            {text.split(/\s+/).filter(Boolean).length} words
                        </span>
                    </div>
                </div>
            )}

            {/* Teleprompter mode */}
            {mode === "teleprompter" && (
                <div className="flex-1 flex flex-col min-h-0">
                    {/* Scrolling text area with fade edges */}
                    <div className="relative flex-1 min-h-0">
                        {/* Top fade */}
                        <div className="absolute top-0 left-0 right-0 h-12 z-10 pointer-events-none"
                            style={{ background: "linear-gradient(to bottom, var(--color-base-300), transparent)" }} />
                        {/* Bottom fade */}
                        <div className="absolute bottom-0 left-0 right-0 h-12 z-10 pointer-events-none"
                            style={{ background: "linear-gradient(to top, var(--color-base-300), transparent)" }} />

                        <div
                            ref={scrollRef}
                            className="h-full overflow-y-auto px-6 py-14 no-scrollbar"
                            style={{
                                transform: isMirrored ? "scaleX(-1)" : "none",
                            }}>
                            {displayText ? (
                                <p className="leading-loose text-base-content whitespace-pre-wrap break-words"
                                    style={{ fontSize: FONT_SIZES[fontSize] + 4 }}>
                                    {displayText}
                                </p>
                            ) : (
                                <p className="text-center opacity-30 mt-8"
                                    style={{ fontSize: FONT_SIZES[fontSize] }}>
                                    No text yet. Switch to edit mode to type or dictate your script.
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Teleprompter controls */}
                    <div className="flex items-center gap-1.5 px-2 py-1.5 bg-base-200/80 border-t border-base-content/10">
                        {/* Play / Pause */}
                        <button
                            className={`btn btn-sm ${isScrolling ? "btn-warning" : "btn-primary"}`}
                            onClick={() => setIsScrolling(!isScrolling)}
                            title={isScrolling ? "Pause" : "Play"}>
                            {isScrolling
                                ? <PauseIcon className="size-4" />
                                : <PlayIcon className="size-4" />
                            }
                        </button>

                        {/* Reset */}
                        <button className="btn btn-sm btn-ghost" onClick={resetScroll} title="Reset to top">
                            <ArrowPathIcon className="size-4" />
                        </button>

                        {/* Speed control */}
                        <div className="flex items-center gap-0.5">
                            <button className="btn btn-xs btn-ghost"
                                onClick={() => setScrollSpeed(Math.max(0, scrollSpeed - 1))}
                                disabled={scrollSpeed === 0}>
                                <ChevronDownIcon className="size-3" />
                            </button>
                            <span className="text-xs font-mono w-7 text-center opacity-70">
                                {SPEED_LABELS[scrollSpeed]}
                            </span>
                            <button className="btn btn-xs btn-ghost"
                                onClick={() => setScrollSpeed(Math.min(SCROLL_SPEEDS.length - 1, scrollSpeed + 1))}
                                disabled={scrollSpeed === SCROLL_SPEEDS.length - 1}>
                                <ChevronUpIcon className="size-3" />
                            </button>
                        </div>

                        <div className="flex-1" />

                        {/* Speech-to-text in teleprompter mode */}
                        {hasSpeechSupport && (
                            <button
                                className={`btn btn-sm ${isListening ? "btn-error" : "btn-ghost"}`}
                                onClick={isListening ? stopListening : startListening}
                                title={isListening ? "Stop listening" : "Start speech-to-text"}>
                                <MicrophoneIcon className="size-4" />
                            </button>
                        )}

                        {/* Timer (shows during recording) */}
                        {isRecording && (
                            <div className="flex items-center gap-1">
                                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                <span className="text-xs font-mono text-red-400">
                                    {formatTime(elapsed)}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Info bar for edit mode */}
            {mode === "edit" && !text && (
                <div className="px-3 pb-2">
                    <div className="text-xs opacity-40 space-y-1">
                        <p>This window won't appear in your recording.</p>
                        <p>Position it near your camera for a teleprompter effect.</p>
                    </div>
                </div>
            )}
        </div>
    </>)
}
