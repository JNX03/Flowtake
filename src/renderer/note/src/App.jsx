import { useCallback, useEffect, useRef, useState } from "react"
import TitleBar from "../../components/TitleBar"
import {
    MagnifyingGlassMinusIcon,
    MagnifyingGlassPlusIcon,
    ArrowPathIcon,
    MicrophoneIcon,
    PencilSquareIcon,
    ViewColumnsIcon,
} from "@heroicons/react/16/solid"

const FONT_SIZES = [16, 20, 26, 34, 44]

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition

// Normalize a word for fuzzy matching: lowercase, strip punctuation
function normalize(word) {
    return word.toLowerCase().replace(/[^a-z0-9']/g, "")
}

// Check if two normalized words are a close enough match
function wordsMatch(spoken, script) {
    if (!spoken || !script) return false
    if (spoken === script) return true
    // Allow partial match for longer words (speech recognition can truncate)
    if (script.length > 4 && spoken.length > 3) {
        if (script.startsWith(spoken) || spoken.startsWith(script)) return true
    }
    // Simple edit distance check for short words - allow 1 char difference
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

// Split text into tokens preserving whitespace for rendering
// Returns array of { word, trailing } where trailing is the whitespace/newlines after the word
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
    const [mode, setMode] = useState("edit") // "edit" | "teleprompter"
    const [fontSize, setFontSize] = useState(2)
    const [isRecording, setIsRecording] = useState(false)

    // Speech-follow state
    const [isFollowing, setIsFollowing] = useState(false)
    const [cursor, setCursor] = useState(0) // index of current word in script
    const [interimCursor, setInterimCursor] = useState(0) // tentative position from interim results
    const [isMirrored, setIsMirrored] = useState(false)
    const [hasSpeechSupport] = useState(() => !!SpeechRecognition)

    // Edit mode dictation
    const [isDictating, setIsDictating] = useState(false)
    const [interimText, setInterimText] = useState("")

    // Timer
    const [elapsed, setElapsed] = useState(0)

    // Refs
    const scrollRef = useRef(null)
    const recognitionRef = useRef(null)
    const timerRef = useRef(null)
    const cursorRef = useRef(0) // mirror of cursor for use in callbacks
    const currentWordRef = useRef(null) // ref to the current highlighted word element
    const tokensRef = useRef([]) // mirror of tokens for use in callbacks

    // Compute tokens from text
    const tokens = tokenize(text)
    tokensRef.current = tokens
    const normalizedScript = tokens.map(t => normalize(t.word))

    // Keep cursorRef in sync
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

    // Auto-scroll to keep current word visible
    useEffect(() => {
        if (mode !== "teleprompter" || !currentWordRef.current || !scrollRef.current) return
        const container = scrollRef.current
        const el = currentWordRef.current
        const elRect = el.getBoundingClientRect()
        const containerRect = container.getBoundingClientRect()

        // Scroll so current word is roughly in the top third of the view
        const targetOffset = containerRect.height * 0.33
        const currentOffset = elRect.top - containerRect.top
        if (Math.abs(currentOffset - targetOffset) > 40) {
            container.scrollTo({
                top: container.scrollTop + (currentOffset - targetOffset),
                behavior: "smooth"
            })
        }
    }, [cursor, interimCursor, mode])

    // Match spoken words against the script, advancing the cursor
    const matchSpokenWords = useCallback((spokenText, isFinal) => {
        const spokenWords = spokenText.trim().split(/\s+/).map(normalize).filter(Boolean)
        if (spokenWords.length === 0) return

        const scriptNorm = tokensRef.current.map(t => normalize(t.word))
        let pos = cursorRef.current

        // Try to match each spoken word to the script starting from current position
        // Allow looking ahead up to 3 words to handle skips/insertions
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
            // If no match in look-ahead, the user might have ad-libbed - skip this spoken word
            if (!matched) continue
        }

        if (isFinal && pos > cursorRef.current) {
            setCursor(pos)
            setInterimCursor(pos)
        } else if (!isFinal && pos > cursorRef.current) {
            setInterimCursor(pos)
        }
    }, [])

    // Start speech following in teleprompter mode
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
                if (event.results[i].isFinal) {
                    finalTranscript += transcript
                } else {
                    interim += transcript
                }
            }
            if (finalTranscript) matchSpokenWords(finalTranscript, true)
            if (interim) matchSpokenWords(interim, false)
        }

        recognition.onerror = (event) => {
            if (event.error !== "no-speech") {
                console.warn("Speech recognition error:", event.error)
            }
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

    // Start dictation in edit mode (appends spoken text)
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
                if (event.results[i].isFinal) {
                    finalTranscript += transcript
                } else {
                    interim += transcript
                }
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

    // Cleanup
    useEffect(() => () => stopRecognition(), [stopRecognition])

    const toggleMode = () => {
        if (mode === "edit") {
            stopRecognition()
            setMode("teleprompter")
            setCursor(0)
            setInterimCursor(0)
            if (scrollRef.current) scrollRef.current.scrollTop = 0
        } else {
            stopRecognition()
            setMode("edit")
        }
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

    // Determine the visual cursor (use interim for more responsive highlighting)
    const visualCursor = Math.max(cursor, interimCursor)

    // Render script words with highlighting
    const renderScript = () => {
        if (tokens.length === 0) {
            return (
                <p className="text-center opacity-30 mt-8" style={{ fontSize: FONT_SIZES[fontSize] }}>
                    No script yet. Switch to edit mode to type or paste your script.
                </p>
            )
        }

        return (
            <p className="leading-loose whitespace-pre-wrap break-words"
                style={{ fontSize: FONT_SIZES[fontSize] + 4 }}>
                {tokens.map((token, i) => {
                    let className = ""
                    let ref = undefined

                    if (i < cursor) {
                        // Already spoken - dim it
                        className = "text-base-content/30 transition-colors duration-300"
                    } else if (i < visualCursor) {
                        // Interim match - slightly highlighted
                        className = "text-accent/60 transition-colors duration-200"
                    } else if (i === visualCursor) {
                        // Current word - bright highlight
                        className = "text-accent font-semibold transition-colors duration-200"
                        ref = currentWordRef
                    } else {
                        // Upcoming - normal
                        className = "text-base-content transition-colors duration-300"
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

    const progress = tokens.length > 0 ? Math.round((cursor / tokens.length) * 100) : 0

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
            {/* ===== EDIT MODE ===== */}
            {mode === "edit" && (
                <div className="flex-1 flex flex-col min-h-0 p-2 gap-2">
                    <textarea
                        className="textarea textarea-bordered flex-1 resize-none leading-relaxed"
                        style={{ fontSize: FONT_SIZES[fontSize] }}
                        placeholder="Type or paste your script here, or use the mic to dictate..."
                        value={text}
                        onChange={e => setText(e.target.value)}
                    />

                    {isDictating && interimText && (
                        <div className="text-xs text-accent opacity-70 px-1 truncate">
                            {interimText}
                        </div>
                    )}

                    <div className="flex items-center gap-1.5 flex-wrap">
                        {hasSpeechSupport && (
                            <button
                                className={`btn btn-sm ${isDictating ? "btn-error" : "btn-ghost"}`}
                                onClick={isDictating ? stopRecognition : startDictating}
                                title={isDictating ? "Stop dictation" : "Start dictation"}>
                                <MicrophoneIcon className="size-4" />
                                <span className="text-xs">{isDictating ? "Stop" : "Dictate"}</span>
                            </button>
                        )}
                        <div className="flex-1" />
                        <span className="text-xs opacity-50">
                            {text.split(/\s+/).filter(Boolean).length} words
                        </span>
                    </div>

                    {!text && (
                        <div className="text-xs opacity-40 space-y-1 px-1">
                            <p>This window won't appear in your recording.</p>
                            <p>Write your script, then switch to teleprompter mode.</p>
                            <p>Speak and it follows along, highlighting where you are.</p>
                        </div>
                    )}
                </div>
            )}

            {/* ===== TELEPROMPTER MODE ===== */}
            {mode === "teleprompter" && (
                <div className="flex-1 flex flex-col min-h-0">
                    {/* Script display with fade edges */}
                    <div className="relative flex-1 min-h-0">
                        <div className="absolute top-0 left-0 right-0 h-14 z-10 pointer-events-none"
                            style={{ background: "linear-gradient(to bottom, var(--color-base-300), transparent)" }} />
                        <div className="absolute bottom-0 left-0 right-0 h-14 z-10 pointer-events-none"
                            style={{ background: "linear-gradient(to top, var(--color-base-300), transparent)" }} />

                        <div
                            ref={scrollRef}
                            className="h-full overflow-y-auto px-6 py-16 no-scrollbar"
                            style={{ transform: isMirrored ? "scaleX(-1)" : "none" }}>
                            {renderScript()}
                        </div>
                    </div>

                    {/* Progress bar */}
                    {tokens.length > 0 && (
                        <div className="h-1 bg-base-200">
                            <div className="h-full bg-accent transition-all duration-500 ease-out"
                                style={{ width: `${progress}%` }} />
                        </div>
                    )}

                    {/* Controls */}
                    <div className="flex items-center gap-1.5 px-2 py-1.5 bg-base-200/80 border-t border-base-content/10">
                        {/* Follow button - the main feature */}
                        {hasSpeechSupport && (
                            <button
                                className={`btn btn-sm ${isFollowing ? "btn-error" : "btn-accent"}`}
                                onClick={isFollowing ? stopRecognition : startFollowing}
                                title={isFollowing ? "Stop following" : "Start following your voice"}>
                                <MicrophoneIcon className="size-4" />
                                <span className="text-xs">{isFollowing ? "Stop" : "Follow"}</span>
                            </button>
                        )}

                        {/* Reset */}
                        <button className="btn btn-sm btn-ghost" onClick={resetProgress} title="Reset to beginning">
                            <ArrowPathIcon className="size-4" />
                        </button>

                        <div className="flex-1" />

                        {/* Progress text */}
                        <span className="text-xs opacity-50 font-mono">
                            {progress}%
                        </span>

                        {/* Recording timer */}
                        {isRecording && (
                            <div className="flex items-center gap-1 ml-2">
                                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                <span className="text-xs font-mono text-red-400">
                                    {formatTime(elapsed)}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    </>)
}
