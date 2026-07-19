import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const readSource = file => readFile(new URL(file, import.meta.url), "utf8")

const [
    mainApp,
    launcher,
    newRecording,
    deviceSelect,
    cameraPreview,
    recordButton,
    generalSettings,
    recorderSettings,
    speechSettings,
    updateSettings,
    plugins,
    recorderOverlay,
    recorderTutorial,
    tutorialSteps,
    nativeRecording,
    nativeWindows,
] = await Promise.all([
    readSource("../app/windows/main/App.jsx"),
    readSource("../app/windows/main/components/Launcher.jsx"),
    readSource("../app/windows/main/components/newRecording/NewRecording.jsx"),
    readSource("../app/windows/main/components/newRecording/CameraMicrophoneSelect.jsx"),
    readSource("../app/windows/main/components/newRecording/CameraPreview.jsx"),
    readSource("../app/windows/main/components/newRecording/RecordButton.jsx"),
    readSource("../app/windows/main/components/settings/GeneralSettings.jsx"),
    readSource("../app/windows/main/components/settings/RecorderSettings.jsx"),
    readSource("../app/windows/main/components/settings/SpeechToTextSettings.jsx"),
    readSource("../app/windows/main/components/settings/UpdatesSettings.jsx"),
    readSource("../app/windows/main/components/plugins/Plugins.jsx"),
    readSource("../app/windows/recorder/App.jsx"),
    readSource("../app/windows/recorder/components/RecorderTutorial.jsx"),
    readSource("../app/windows/main/components/tutorial/steps.js"),
    readSource("../src-tauri/src/commands/recording.rs"),
    readSource("../src-tauri/src/commands/windows.rs"),
])

test("cold hardware encoder probing does not hold the startup splash", () => {
    const splashIndex = mainApp.indexOf("dismissSplash()", mainApp.indexOf("const earlyData"))
    const encoderIndex = mainApp.indexOf("const e = await earlyData.encoders")

    assert.ok(splashIndex >= 0, "startup should dismiss the splash after cheap setup checks")
    assert.ok(encoderIndex > splashIndex, "hardware encoder probing should finish after the launcher is visible")
})

test("launcher mounts only the active lazy view and separates experimental tools", () => {
    assert.match(launcher, /const NewRecording = lazy/)
    assert.match(launcher, /const VIEW_ORDER = \[VIEW_RECORD, VIEW_PROJECTS\]/)
    assert.match(launcher, /const EXPERIMENTAL_VIEW_ORDER = \[VIEW_PLUGINS\]/)
    assert.doesNotMatch(launcher, /VIEW_LIVE|import\("\.\/live\/Live"\)/)
    assert.match(launcher, /activeView === VIEW_RECORD && <NewRecording isOpen/)
    assert.doesNotMatch(launcher, /flowtake-nav-item/)
})

test("record setup applies audio processing to preview and captured media", () => {
    for (const source of [cameraPreview, recordButton]) {
        assert.match(source, /\.\.\.CONSTRAINTS_AUDIO, \.\.\.audioProcessingSettings, deviceId: \{ exact:/)
    }
    assert.match(newRecording, /audioProcessingSettings=\{audioProcessingSettings\}/)
    assert.match(recordButton, /role="alert"/)
})

test("device detection stays permission-quiet until a deliberate device action", () => {
    assert.match(deviceSelect, /One lightweight permission probe/)
    assert.match(deviceSelect, /await navigator\.mediaDevices\.enumerateDevices\(\)/)
    assert.match(deviceSelect, /device\.deviceId !== "default" && device\.deviceId !== "communications"/)
    assert.match(deviceSelect, /id: `mediaSource-\$\{device\.deviceId \|\| device\.groupId \|\| device\.label\}`/)
    assert.doesNotMatch(deviceSelect, /randomUUID/)
    assert.doesNotMatch(deviceSelect, /useEffect/)
    assert.doesNotMatch(deviceSelect, /queryKey: \['devices'/)
    assert.equal(deviceSelect.match(/\bdetectCameras\(/g)?.length, 2)
    assert.equal(deviceSelect.match(/\bdetectMicrophones\(/g)?.length, 2)
    assert.match(deviceSelect, /detectCameras\(\{ selectFirst: true \}\)/)
    assert.match(deviceSelect, /detectMicrophones\(\{ selectFirst: true \}\)/)
    assert.match(deviceSelect, /cameras\.some\(device => device\.id === camera\)[\s\S]*?\? camera[\s\S]*?: selectFirst \? cameras\[0\]\?\.id \?\? null : null/)
    assert.match(deviceSelect, /microphones\.some\(device => device\.id === microphone\)[\s\S]*?\? microphone[\s\S]*?: selectFirst \? microphones\[0\]\?\.id \?\? null : null/)
    assert.match(deviceSelect, /onClick=\{refreshDevices\}/)
    assert.match(deviceSelect, /Camera and mic stay off until you choose one\./)
})

test("record shell exposes responsive readiness and accessible source controls", () => {
    assert.match(newRecording, /flex flex-col md:flex-row/)
    assert.match(newRecording, /Recording quality summary/)
    assert.match(newRecording, /\{screenFps \?\? 30\} FPS/)
    assert.match(newRecording, /recordingQuality \|\| "balanced"/)
    assert.match(newRecording, /aria-pressed=\{active\}/)
    assert.match(newRecording, /refetchInterval: screenPermissionDenied \|\| previewUnavailable \? 10000 : 5000/)
})

test("settings show only controls backed by working behavior", () => {
    for (const deadKey of ["defaultResolution", "autoSaveInterval", "notificationsEnabled", "isIssueReportingEnabled"]) {
        assert.doesNotMatch(generalSettings, new RegExp(deadKey))
    }
    assert.doesNotMatch(speechSettings, /sttAutoGenerate/)
    assert.doesNotMatch(updateSettings, /autoUpdateEnabled/)
    assert.doesNotMatch(recorderSettings, /value="auto"/)
    assert.match(recorderSettings, /item\?\.value \?\? item\?\.name/)
    assert.match(recorderSettings, /Refresh video encoders/)
    assert.match(recorderSettings, /store-get", "recordingQuality"/)
    assert.match(recorderSettings, /value="performance"/)
    assert.match(recorderSettings, /value="quality"/)
    assert.match(generalSettings, /get-content-protection/)
    assert.match(generalSettings, /macOS no longer lets apps block system screenshots or third-party captures/)
    assert.match(generalSettings, /Window capture protection is unavailable on Linux/)
    assert.match(nativeWindows, /stored\.unwrap_or\(!cfg!\(debug_assertions\)\)/)
    assert.doesNotMatch(nativeWindows, /if cfg!\(debug_assertions\) \{[\s\S]*?return false/)
})

test("experimental page exposes runtime-backed built-ins without drop-in claims", () => {
    assert.doesNotMatch(plugins, /list-plugins|open-plugins-folder|Drop-in plugins/)
    assert.match(plugins, /\[FEATURE_IDS\.APP_RECORDING\]: AppRecordingFeature/)
    assert.doesNotMatch(plugins, /\[FEATURE_IDS\.MOUSE_STYLE\]: MouseStyleFeature/)
    assert.doesNotMatch(plugins, /\[FEATURE_IDS\.KEYBOARD_OVERLAY\]: KeyboardOverlayFeature/)
    assert.match(plugins, /windowsOnly: true/)
    assert.match(plugins, /aria-expanded=\{isSettingsOpen\}/)
})

test("individual app capture reports the tracks that actually started", () => {
    assert.match(recorderOverlay, /const tracks = await window\.electron\.ipcRenderer\.invoke\("start-multi-app-capture", picked\)/)
    assert.match(recorderOverlay, /started === 0/)
    assert.match(recorderOverlay, /status: "partial"/)
    assert.match(recorderOverlay, /selected app windows are no longer available/i)
})

test("recording start is guarded against duplicate UI commands", () => {
    assert.match(recordButton, /startInFlightRef\.current \|\| isRecording/)
    assert.match(recordButton, /disabled=\{isStarting \|\| isRecording/)
    assert.match(recorderOverlay, /recordingStartClaimRef\.current/)
    assert.match(recorderOverlay, /deviceRecorderInitRef\.current/)
    assert.match(recorderOverlay, /!countdownArmedRef\.current/)
})

test("recorder actions stay reachable and serialize destructive transitions", () => {
    const compactStart = recorderOverlay.indexOf("if (!isExpanded && !tutorialActive)")
    const expandedStart = recorderOverlay.indexOf("role=\"toolbar\"")
    const compactSource = recorderOverlay.slice(compactStart, expandedStart)

    assert.match(compactSource, /aria-label=\{`Show recording controls\. Recording time/)
    assert.match(compactSource, /aria-expanded="false"/)
    assert.match(compactSource, /setIsExpansionPinned\(true\)/)
    assert.match(compactSource, /title=\{stopActionTitle\}/)
    assert.match(recorderOverlay, /!tutorialActive && !isExpansionPinned/)
    assert.match(recorderOverlay, /if \(actionLockRef\.current\) return false/)
    assert.match(recorderOverlay, /new Set\(\["confirming", "saving", "restarting", "discarding"\]\)/)
    assert.match(recorderOverlay, /Saving recording/)
    assert.match(recorderOverlay, /Restarting recording/)
    assert.match(recorderOverlay, /Discarding recording/)
    assert.match(recorderOverlay, /status: "error"/)
    assert.match(recorderOverlay, /aria-live="polite"/)
})

test("restart and discard require confirmation and restore real device tracks", () => {
    assert.match(recorderOverlay, /Restart this recording\? The current take will be permanently discarded\./)
    assert.match(recorderOverlay, /Discard this recording\? This take cannot be recovered\./)
    assert.match(recorderOverlay, /cancelLabel: "Keep recording"/)
    assert.match(recorderOverlay, /deviceRecorder\?\.stream\?\.getTracks\(\)\.forEach\(track =>/)
    assert.match(recorderOverlay, /track\.enabled = true/)
    assert.match(recorderOverlay, /stop-multi-app-capture/)
})

test("save keeps retry controls alive and propagates required track failures", () => {
    assert.match(recorderOverlay, /throw new Error\(`Camera or microphone track could not be finalized\./)

    const normalStop = recorderOverlay.slice(
        recorderOverlay.indexOf("const onClickStop = async"),
        recorderOverlay.indexOf("const onClickRestart = async")
    )
    assert.match(normalStop, /stopRuntimeFeatures\(\{ stopAppCapture: false \}\)/)
    assert.doesNotMatch(normalStop, /stop-multi-app-capture/)

    const nativeStop = recorderOverlay.indexOf('invoke("stop-recording")')
    const deviceDestroy = recorderOverlay.indexOf("deviceRecorder?.destroy()", nativeStop)
    assert.ok(nativeStop >= 0, "expected the native save command")
    assert.ok(deviceDestroy > nativeStop, "device resources must remain until native save succeeds")

    assert.match(
        nativeRecording,
        /if let Some\(error\) = project_save_failure\.take\(\) \{[\s\S]*?return Err\(error\);[\s\S]*?get_webview_window\("recorder"\)/,
        "native save failures must return before the recorder window is closed"
    )
    assert.match(nativeRecording, /probe_device_recording\(&camera_dest, has_camera, has_mic\)/)
    assert.match(nativeRecording, /state\.recording_id = None;/)
    assert.match(nativeRecording, /let project_id = state\.project_id\.take\(\);/)

    assert.match(recorderOverlay, /setIsCaptureFinalized\(true\)[\s\S]*?invoke\("stop-recording"\)/)
    assert.match(recorderOverlay, /Recording stopped\. Save failed —/)
    assert.match(recorderOverlay, /isCaptureFinalized \? "Retry save" : "Retry stop and save"/)
    assert.match(recorderOverlay, /!isCaptureFinalized && \([\s\S]*?title="Restart recording"/)
})

test("first recording has one truthful tutorial owner", () => {
    assert.match(recorderTutorial, /if \(main && !rec\)/)
    assert.doesNotMatch(recorderTutorial, /rec-pause|Pause and resume/)
    assert.match(recorderTutorial, /Stop and save/)
    assert.doesNotMatch(tutorialSteps, /keyboard shortcut/i)
    assert.match(tutorialSteps, /always-visible Stop and save button/)
})
