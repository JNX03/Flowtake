import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const readSource = file => readFile(new URL(file, import.meta.url), "utf8")

const [mainApp, setupWizard, generalSettings, areaPicker, newRecording, recordButton, appLayers] = await Promise.all([
    readSource("../app/windows/main/App.jsx"),
    readSource("../app/windows/main/components/SetupWizard.jsx"),
    readSource("../app/windows/main/components/settings/GeneralSettings.jsx"),
    readSource("../app/windows/areaPicker/App.jsx"),
    readSource("../app/windows/main/components/newRecording/NewRecording.jsx"),
    readSource("../app/windows/main/components/newRecording/RecordButton.jsx"),
    readSource("../app/windows/main/components/settings/plugin/features/AppRecordingFeature.jsx"),
])

test("first-run setup stays focused on readiness and recording", () => {
    assert.match(setupWizard, /\{ id: "permissions", label: "Readiness" \}/)
    assert.match(setupWizard, /\{ id: "done", label: "Record" \}/)
    assert.doesNotMatch(setupWizard, /ExportPathStep|AppearanceStep/)
    assert.match(generalSettings, /flowtake-run-setup/)
    assert.match(mainApp, /addEventListener\("flowtake-run-setup"/)
    assert.doesNotMatch(generalSettings, /location\.reload/)
})

test("restarted recording tutorial closes settings before it starts", () => {
    assert.match(
        generalSettings,
        /const restartTutorial = useCallback\(async \(\) => \{[\s\S]*?setOpenSettings\(null\)[\s\S]*?resetTutorial\(\)[\s\S]*?startTutorial\(\)/
    )
})

test("area selection exposes persistent confirmation and keyboard recovery", () => {
    assert.match(areaPicker, /Record this area/)
    assert.match(areaPicker, /event\.key === "Enter"/)
    assert.match(areaPicker, /event\.key === "Escape"/)
    assert.doesNotMatch(areaPicker, /group-hover:opacity-100/)
})

test("record action stays outside the scrolling setup and repairs missing engines", () => {
    const scrollStart = newRecording.indexOf("overflow-y-auto overflow-x-hidden")
    const scrollEnd = newRecording.indexOf("data-tutorial=\"record-button\"")
    assert.ok(scrollStart >= 0 && scrollEnd > scrollStart)
    assert.match(recordButton, /Set up recorder/)
    assert.doesNotMatch(recordButton, /isLoading=\{[^}]*!capturers/)
})

test("extra app layers are capped for predictable resource use", () => {
    assert.match(appLayers, /const MAX_APP_LAYERS = 2/)
    assert.match(appLayers, /disabled=\{atLimit\}/)
})
