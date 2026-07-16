import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const [liveSource, stateSource, storeSource, settingsSource, settingsUiSource, composerSource, bridgeSource, libSource, tauriConfig] = await Promise.all([
    readFile(new URL("../src-tauri/src/commands/live.rs", import.meta.url), "utf8"),
    readFile(new URL("../src-tauri/src/state.rs", import.meta.url), "utf8"),
    readFile(new URL("../src-tauri/src/commands/store.rs", import.meta.url), "utf8"),
    readFile(new URL("../app/windows/main/components/settings/liveSettingsStore.js", import.meta.url), "utf8"),
    readFile(new URL("../app/windows/main/components/settings/LiveStreamingSettings.jsx", import.meta.url), "utf8"),
    readFile(new URL("../app/windows/liveComposer/composer.jsx", import.meta.url), "utf8"),
    readFile(new URL("../app/shared/tauriBridge.js", import.meta.url), "utf8"),
    readFile(new URL("../src-tauri/src/lib.rs", import.meta.url), "utf8"),
    readFile(new URL("../src-tauri/tauri.conf.json", import.meta.url), "utf8").then(JSON.parse),
])

test("live destinations and media queues fail closed", () => {
    assert.match(liveSource, /Only RTMP and RTMPS destinations are allowed/)
    assert.match(liveSource, /RTMP URL must not target a local or private address/)
    assert.match(liveSource, /\.path\(\)\s*\.video_dir\(\)/)
    assert.doesNotMatch(liveSource, /pub local_dir:/)
    assert.match(liveSource, /const MAX_LIVE_FRAME_CHUNK_BYTES: usize = 4 \* 1024 \* 1024/)
    assert.match(liveSource, /mpsc::channel::<Vec<u8>>\(LIVE_FRAME_CHANNEL_CAPACITY\)/)
    assert.match(liveSource, /try_send\(chunk\)/)
    assert.match(stateSource, /live_stdin_tx: Option<mpsc::Sender<Vec<u8>>>/)
})

test("stream keys stay in native session memory and never generic settings", () => {
    assert.match(liveSource, /#\[serde\(skip\)\]\s+pub stream_key: String/)
    assert.match(liveSource, /pub async fn set_live_stream_key/)
    assert.match(liveSource, /pub async fn has_live_stream_key/)
    assert.match(stateSource, /live_stream_credential: Option<LiveStreamCredential>/)
    assert.match(liveSource, /Configured stream key is bound to a different RTMP destination/)
    assert.match(liveSource, /config\.rtmp_url = credential\.canonical_rtmp_url\.clone\(\)/)
    assert.match(storeSource, /settings\.remove\("streamKey"\)/)
    assert.match(storeSource, /pub fn migrate_legacy_live_settings/)
    assert.match(libSource, /migrate_legacy_live_settings\(&app_handle\)/)
    assert.match(settingsSource, /invoke\("set-live-stream-key", rtmpUrl, streamKey\)/)
    assert.match(bridgeSource, /set_live_stream_key': \(args\) => \(\{ rtmpUrl: args\[0\], streamKey: args\[1\] \}\)/)
    assert.match(settingsSource, /has-live-stream-key/)
    assert.match(settingsSource, /hasStreamKey: _status, \.\.\.persisted/)
    assert.match(settingsUiSource, /Save session key/)
    assert.match(settingsUiSource, /setStreamKeyDraft\(""\)/)
    assert.doesNotMatch(settingsUiSource, /onChange=\{\(e\) => updateStreamKey/)
    assert.doesNotMatch(composerSource, /streamKey:/)
})

test("legacy live-key migration fails closed before renderer startup", () => {
    const mainWindow = tauriConfig.app.windows.find(window => window.label === "main")
    const migration = libSource.slice(
        libSource.indexOf("migrate_legacy_live_settings(&app_handle)"),
        libSource.indexOf("WebviewWindowBuilder::from_config"),
    )

    assert.equal(mainWindow?.create, false, "Tauri must not create the renderer before setup migrations")
    assert.match(migration, /Err\(error\) =>/)
    assert.match(migration, /return Err\(Box::new\(error\)\)/)
    assert.doesNotMatch(migration, /Err\(_\) => log::warn/)
    assert.match(libSource, /WebviewWindowBuilder::from_config\(app\.handle\(\), &main_window_config\)\?\.build\(\)\?/)
})

test("Save removes the live-key draft from visible state before awaiting native storage", () => {
    const saveHandler = settingsUiSource.slice(
        settingsUiSource.indexOf("const saveStreamKey = async"),
        settingsUiSource.indexOf("const clearStreamKey = async"),
    )
    const clearDraft = saveHandler.indexOf('setStreamKeyDraft("")')
    const hideDraft = saveHandler.indexOf("setShowKey(false)")
    const nativeAwait = saveHandler.indexOf("await setLiveStreamKey")

    assert.ok(clearDraft >= 0 && clearDraft < nativeAwait)
    assert.ok(hideDraft >= 0 && hideDraft < nativeAwait)
    assert.match(saveHandler, /setLiveStreamKey\(settings\?\.rtmpUrl \|\| "", keyForNativeSession\)/)
})

test("FFmpeg diagnostics never forward a credential-bearing stderr line", () => {
    assert.match(liveSource, /sensitive details suppressed/)
    assert.doesNotMatch(liveSource, /log::warn!\("\[live\] \{\}", line\)/)
})

test("live stream starts are serialized across the FFmpeg spawn boundary", () => {
    assert.match(
        stateSource,
        /live_stream_start_lock:\s*Arc<tokio::sync::Mutex<\(\)>>/,
    )

    const startCommand = liveSource.slice(
        liveSource.indexOf("pub async fn start_live_streaming"),
        liveSource.indexOf("pub async fn push_live_frame"),
    )
    const lockPosition = startCommand.indexOf("start_lock.lock().await")
    const spawnPosition = startCommand.indexOf(".spawn()")
    const publishPosition = startCommand.indexOf("st.live_ffmpeg_process = Some(child)")

    assert.ok(lockPosition >= 0, "start command must acquire the native start lock")
    assert.ok(spawnPosition > lockPosition, "FFmpeg must spawn while the start lock is held")
    assert.ok(
        publishPosition > spawnPosition,
        "the child must be published before the start lock leaves scope",
    )
})
