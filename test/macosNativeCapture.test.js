import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const root = path.resolve(import.meta.dirname, '..')
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8')

test('macOS native capture is built, bundled, and release-tested', () => {
    const packageJson = JSON.parse(read('package.json'))
    const tauriConfig = JSON.parse(read('src-tauri', 'tauri.conf.json'))
    const ci = read('.github', 'workflows', 'ci.yml')
    const release = read('.github', 'workflows', 'main.yml')

    assert.match(packageJson.scripts['test:macos-capture'], /flowtake-macos-capture-tests/)
    assert.match(packageJson.scripts['build:macos-capture'], /build-macos-capture\.sh --native/)
    assert.ok(tauriConfig.bundle.resources.includes('binaries/*'))
    assert.ok(tauriConfig.app.security.assetProtocol.scope.includes('$APPDATA/previews/**'))
    assert.match(ci, /Test native macOS capture helper/)
    assert.match(release, /build-macos-capture\.sh --universal/)
    assert.match(release, /flowtake-macos-capture-universal-apple-darwin/)
})

test('native capture uses ScreenCaptureKit with a real MP4 writer and bounded queue', () => {
    const capture = read(
        'src-tauri',
        'native',
        'macos-capture',
        'Sources',
        'FlowtakeMacCaptureCore',
        'CaptureSession.swift'
    )
    const configuration = read(
        'src-tauri',
        'native',
        'macos-capture',
        'Sources',
        'FlowtakeMacCaptureCore',
        'CaptureConfiguration.swift'
    )
    const recording = read('src-tauri', 'src', 'commands', 'recording.rs')
    const infoPlist = read('src-tauri', 'Info.plist')

    assert.match(capture, /import ScreenCaptureKit/)
    assert.match(capture, /AVAssetWriter/)
    assert.match(capture, /kCVPixelFormatType_420YpCbCr8BiPlanarVideoRange/)
    assert.match(capture, /queueDepth = 5/)
    assert.match(capture, /capturesAudio = true/)
    assert.match(capture, /excludesCurrentProcessAudio = true/)
    assert.match(configuration, /excludedProcessID: Int32\?/)
    assert.match(recording, /"--exclude-process-id"/)
    assert.match(capture, /excludingApplications: \[excludedApplication\]/)
    assert.match(capture, /excludingWindows: excludedWindows/)
    assert.doesNotMatch(capture, /ProcessInfo\.processInfo\.processIdentifier/)
    assert.match(infoPlist, /NSScreenCaptureUsageDescription/)
})

test('Rust lifecycle handshakes, finalizes, and keeps AVFoundation fallback', () => {
    const recording = read('src-tauri', 'src', 'commands', 'recording.rs')
    const encoding = read('src-tauri', 'src', 'commands', 'encoding.rs')
    const state = read('src-tauri', 'src', 'state.rs')

    assert.match(recording, /native-capture\.ready/)
    assert.match(recording, /spawn_macos_capture/)
    assert.match(recording, /Native startup failed; using AVFoundation fallback/)
    assert.match(recording, /stop_macos_capture_process/)
    assert.match(recording, /write_all\(b"stop\\n"\)/)
    assert.match(encoding, /ScreenCaptureKit \(native\)/)
    assert.match(encoding, /AVFoundation \(compatibility\)/)
    assert.match(state, /macos_capture_process: Option<std::process::Child>/)
})

test('macOS editor uses an atomic AVFoundation preview cache with source fallback', () => {
    const proxy = read(
        'src-tauri',
        'native',
        'macos-capture',
        'Sources',
        'FlowtakeMacCaptureCore',
        'PreviewProxy.swift'
    )
    const main = read(
        'src-tauri',
        'native',
        'macos-capture',
        'Sources',
        'FlowtakeMacCapture',
        'FlowtakeMacCaptureMain.swift'
    )
    const files = read('src-tauri', 'src', 'commands', 'files.rs')
    const videoWrapper = read('app', 'windows', 'main', 'components', 'VideoWrapper.jsx')

    assert.match(main, /make-preview-proxy/)
    assert.match(proxy, /AVAssetExportSession/)
    assert.match(proxy, /AVMutableVideoComposition/)
    assert.match(proxy, /shouldOptimizeForNetworkUse = true/)
    assert.match(proxy, /\.partial\.mp4/)
    assert.match(proxy, /source audio track was not preserved/)
    assert.match(files, /"screen-preview" => state\.editor_screen_video_file/)
    assert.match(videoWrapper, /useVideoSrc\("screen-preview", projectId\)/)
})
