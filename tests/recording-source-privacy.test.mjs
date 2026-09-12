import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { test } from "node:test"

const readRepoFile = file => readFile(new URL(`../${file}`, import.meta.url), "utf8")

test("recording requires an explicit source confirmation", async () => {
    const [slice, launcher, recordButton] = await Promise.all([
        readRepoFile("app/shared/redux/recorderSlice.js"),
        readRepoFile("app/windows/main/components/newRecording/NewRecording.jsx"),
        readRepoFile("app/windows/main/components/newRecording/RecordButton.jsx"),
    ])

    assert.match(slice, /isSourceConfirmed:\s*false/)
    assert.match(slice, /sourceConfirmationRevision:\s*0/)
    assert.match(slice, /confirmSource/)
    assert.match(slice, /sourceConfirmationRevision \+= 1/)
    assert.match(launcher, /dispatch\(confirmSource\(\)\)/)
    assert.match(launcher, /confirm exactly what Flowtake may capture/)
    assert.match(launcher, /enabled:\s*isOpen\s*&&\s*isSourceConfirmed\s*&&\s*!!previewSource/)
    assert.match(launcher, /!isSourceConfirmed && <><ComputerDesktopIcon[^>]*\/> No source<\/>/)
    assert.match(launcher, /isSourceConfirmed && sourceDetail\(\)/)
    assert.match(launcher, /isSourceConfirmed && <div[^>]*>\s*\{source\.type === SOURCE_TYPE_SCREEN/)
    assert.match(recordButton, /isRecording \|\| !isSourceConfirmed/)
    assert.match(recordButton, /disabled=.*!isSourceConfirmed/)
})

test("every explicit source confirmation can advance a restarted tutorial", async () => {
    const tutorial = await readRepoFile("app/windows/main/components/tutorial/TutorialProvider.jsx")

    assert.match(tutorial, /selectSourceConfirmationRevision/)
    assert.match(tutorial, /sourceConfirmationRevision > previousSourceConfirmationRef\.current/)
})

test("automatic monitor discovery does not count as user confirmation", async () => {
    const launcher = await readRepoFile("app/windows/main/components/newRecording/NewRecording.jsx")
    const autoSelectEffect = launcher.slice(
        launcher.indexOf("// Auto-select primary monitor"),
        launcher.indexOf("// Close monitor picker")
    )

    assert.match(autoSelectEffect, /dispatch\(setSource/)
    assert.doesNotMatch(autoSelectEffect, /confirmSource/)
})

test("live preview and broadcast also wait for explicit source confirmation", async () => {
    const [live, goLiveButton] = await Promise.all([
        readRepoFile("app/windows/main/components/live/Live.jsx"),
        readRepoFile("app/windows/main/components/live/GoLiveButton.jsx"),
    ])

    assert.match(live, /enabled:\s*isOpen && isSourceConfirmed && !!previewSource/)
    assert.match(live, /dispatch\(confirmSource\(\)\)/)
    assert.match(goLiveButton, /isRecording \|\| !isSourceConfirmed/)
    assert.match(goLiveButton, /!isConfigured \|\| !isSourceConfirmed/)
})
