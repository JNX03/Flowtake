import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8")

test("macOS builds and bundles a universal native capture helper", async () => {
  const [config, buildScript, workflow] = await Promise.all([
    read("src-tauri/tauri.macos.conf.json"),
    read("scripts/build-macos-capture.sh"),
    read(".github/workflows/ci.yml"),
  ])
  const parsed = JSON.parse(config)

  assert.match(parsed.build.beforeBuildCommand, /build:macos-capture/)
  assert.ok(parsed.bundle.externalBin.includes("binaries/flowtake-macos-capture"))
  assert.match(buildScript, /arm64-apple-macosx13\.0/)
  assert.match(buildScript, /x86_64-apple-macosx13\.0/)
  assert.match(buildScript, /lipo -create/)
  assert.match(workflow, /Build universal ScreenCaptureKit helper/)
})

test("native capture uses low-bandwidth frames, system audio, and atomic output", async () => {
  const swift = await read("native/macos-capture/Sources/main.swift")

  assert.match(swift, /import ScreenCaptureKit/)
  assert.match(swift, /kCVPixelFormatType_420YpCbCr8BiPlanarVideoRange/)
  assert.match(swift, /configuration\.capturesAudio = options\.capturesSystemAudio/)
  assert.match(swift, /onScreenWindowsOnly: false/)
  assert.match(swift, /native-partial\.mp4/)
  assert.match(swift, /event: "ready"/)
  assert.match(swift, /if videoInput\.isReadyForMoreMediaData, videoInput\.append\(sampleBuffer\)/)
  assert.match(swift, /sampleHandlerQueue: writerQueue/)
})

test("Rust and the recorder UI keep an FFmpeg fallback", async () => {
  const [rust, bridge, recorder, button] = await Promise.all([
    read("src-tauri/src/commands/recording.rs"),
    read("app/shared/tauriBridge.js"),
    read("app/windows/main/components/newRecording/NewRecording.jsx"),
    read("app/windows/main/components/newRecording/RecordButton.jsx"),
  ])

  assert.match(rust, /macos_capture::try_spawn/)
  assert.match(rust, /using FFmpeg fallback/)
  assert.match(rust, /ffmpeg_args\.filter\(\|_\| !native_capture_started\)/)
  assert.match(rust, /requiresNativeSystemAudio/)
  assert.match(rust, /will not silently switch to a loopback driver/)
  assert.match(bridge, /'get-macos-capture-status': 'get_macos_capture_status'/)
  assert.match(recorder, /nativeSystemAudio/)
  assert.match(button, /nativeSystemAudio \? true : systemAudio/)
})

test("the generated macOS bundle declares real TCC usage descriptions", async () => {
  const [plist, entitlements] = await Promise.all([
    read("src-tauri/Info.plist"),
    read("src-tauri/Entitlements.plist"),
  ])

  assert.match(plist, /NSScreenCaptureUsageDescription/)
  assert.match(plist, /NSCameraUsageDescription/)
  assert.match(plist, /NSMicrophoneUsageDescription/)
  assert.doesNotMatch(entitlements, /com\.apple\.security\.device\.screen-capture/)
  assert.doesNotMatch(entitlements, /com\.apple\.security\.accessibility/)
})
