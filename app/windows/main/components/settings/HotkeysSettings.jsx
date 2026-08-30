import { useMemo, useState } from "react"
import { useHotkeys } from "react-hotkeys-hook"
import { useDispatch } from "react-redux"
import {
    EDITOR_SHORTCUT_REGISTRY,
    formatShortcut,
    shortcutFromKeyboardEvent,
} from "@shared/editor/shortcutRegistry"
import {
    removeEditorShortcut,
    resetEditorShortcuts,
    restoreEditorShortcut,
    setEditorShortcut,
    useEditorShortcutBindings,
} from "@shared/editor/useEditorShortcuts"
import { setOpenSettings } from "@shared/redux/appSlice"

export default function HotkeysSettings() {
    const dispatch = useDispatch()
    const bindings = useEditorShortcutBindings()
    const categories = useMemo(
        () => [...new Set(EDITOR_SHORTCUT_REGISTRY.map(action => action.category))],
        []
    )
    const [recordingActionId, setRecordingActionId] = useState(null)
    const [message, setMessage] = useState(null)
    const [isConfirmingReset, setIsConfirmingReset] = useState(false)

    useHotkeys("ctrl+slash", () => {
        dispatch(setOpenSettings(null))
    }, { preventDefault: true }, [dispatch])

    const beginRecording = actionId => {
        setRecordingActionId(actionId)
        setMessage({
            actionId,
            type: "info",
            text: "Press a shortcut. Escape cancels.",
        })
    }

    const captureShortcut = (action, event) => {
        event.preventDefault()
        event.stopPropagation()
        if (event.key === "Escape") {
            setRecordingActionId(null)
            setMessage(null)
            return
        }

        const shortcut = shortcutFromKeyboardEvent(event)
        if (!shortcut) {
            setMessage({
                actionId: action.id,
                type: "error",
                text: "Press a non-modifier key with any modifiers you want.",
            })
            return
        }

        const result = setEditorShortcut(action.id, shortcut)
        if (!result.ok) {
            setMessage({
                actionId: action.id,
                type: "error",
                text: result.reason === "conflict"
                    ? `${formatShortcut(shortcut)} is already used by ${result.conflict.label}.`
                    : "That shortcut cannot be assigned.",
            })
            return
        }

        setRecordingActionId(null)
        setMessage({
            actionId: action.id,
            type: "success",
            text: `Assigned ${formatShortcut(result.shortcut)}.`,
        })
    }

    const removeShortcut = action => {
        removeEditorShortcut(action.id)
        setRecordingActionId(null)
        setMessage({
            actionId: action.id,
            type: "success",
            text: "Shortcut removed.",
        })
    }

    const restoreShortcut = action => {
        const result = restoreEditorShortcut(action.id)
        setRecordingActionId(null)
        setMessage(result.ok
            ? {
                actionId: action.id,
                type: "success",
                text: "Default restored.",
            }
            : {
                actionId: action.id,
                type: "error",
                text: result.reason === "conflict"
                    ? `The default is already used by ${result.conflict.label}.`
                    : "The default could not be restored.",
            })
    }

    const resetAll = () => {
        resetEditorShortcuts()
        setRecordingActionId(null)
        setIsConfirmingReset(false)
        setMessage({
            actionId: null,
            type: "success",
            text: "All editor shortcuts were reset.",
        })
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h4 className="text-lg font-semibold">Keyboard shortcuts</h4>
                    <p className="mt-1 max-w-2xl text-xs text-base-content/50">
                        Select a shortcut to record a replacement. Conflicts are blocked so every action stays predictable.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {isConfirmingReset ? (
                        <>
                            <button
                                type="button"
                                className="btn btn-error btn-sm"
                                onClick={resetAll}
                            >
                                Confirm reset
                            </button>
                            <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={() => setIsConfirmingReset(false)}
                            >
                                Cancel
                            </button>
                        </>
                    ) : (
                        <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => setIsConfirmingReset(true)}
                        >
                            Reset all
                        </button>
                    )}
                </div>
            </div>

            {message?.actionId === null && (
                <p className="text-xs text-success" role="status">{message.text}</p>
            )}

            {categories.map(category => (
                <section
                    key={category}
                    className="overflow-hidden rounded-xl border border-base-content/10 bg-base-100"
                    aria-labelledby={`shortcut-category-${category}`}
                >
                    <div className="border-b border-base-content/10 bg-base-200/40 px-3 py-2">
                        <h5
                            id={`shortcut-category-${category}`}
                            className="text-xs font-semibold uppercase tracking-wide text-base-content/60"
                        >
                            {category}
                        </h5>
                    </div>
                    <div className="divide-y divide-base-content/8">
                        {EDITOR_SHORTCUT_REGISTRY
                            .filter(action => action.category === category)
                            .map(action => {
                                const actionBindings = bindings[action.id] || []
                                const isRecording = recordingActionId === action.id
                                const isDefault = actionBindings.length === action.defaultBindings.length
                                    && actionBindings.every((binding, index) =>
                                        binding === action.defaultBindings[index])
                                const actionMessage = message?.actionId === action.id
                                    ? message
                                    : null

                                return (
                                    <div
                                        key={action.id}
                                        className="grid gap-2 px-3 py-2.5 sm:grid-cols-[minmax(10rem,1fr)_minmax(13rem,auto)] sm:items-center"
                                    >
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-medium">{action.label}</p>
                                            {actionMessage && (
                                                <p
                                                    className={`mt-0.5 text-[11px] ${
                                                        actionMessage.type === "error"
                                                            ? "text-error"
                                                            : actionMessage.type === "success"
                                                                ? "text-success"
                                                                : "text-info"
                                                    }`}
                                                    role={actionMessage.type === "error" ? "alert" : "status"}
                                                >
                                                    {actionMessage.text}
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex min-w-0 flex-wrap items-center justify-start gap-1.5 sm:justify-end">
                                            <button
                                                type="button"
                                                onClick={() => beginRecording(action.id)}
                                                onKeyDown={isRecording
                                                    ? event => captureShortcut(action, event)
                                                    : undefined}
                                                onBlur={() => {
                                                    if (isRecording) {
                                                        setRecordingActionId(null)
                                                        setMessage(null)
                                                    }
                                                }}
                                                className={`btn btn-sm min-w-32 justify-center ${
                                                    isRecording ? "btn-primary animate-pulse" : "btn-outline"
                                                }`}
                                                aria-label={isRecording
                                                    ? `Recording shortcut for ${action.label}`
                                                    : `Change shortcut for ${action.label}`}
                                                aria-pressed={isRecording}
                                            >
                                                {isRecording ? (
                                                    "Press shortcut..."
                                                ) : actionBindings.length > 0 ? (
                                                    actionBindings.map(binding => (
                                                        <kbd key={binding} className="kbd kbd-sm">
                                                            {formatShortcut(binding)}
                                                        </kbd>
                                                    ))
                                                ) : (
                                                    <span className="text-base-content/45">Unassigned</span>
                                                )}
                                            </button>
                                            <button
                                                type="button"
                                                className="btn btn-ghost btn-xs"
                                                onClick={() => removeShortcut(action)}
                                                disabled={actionBindings.length === 0}
                                            >
                                                Remove
                                            </button>
                                            <button
                                                type="button"
                                                className="btn btn-ghost btn-xs"
                                                onClick={() => restoreShortcut(action)}
                                                disabled={isDefault}
                                            >
                                                Restore
                                            </button>
                                        </div>
                                    </div>
                                )
                            })}
                    </div>
                </section>
            ))}
        </div>
    )
}
