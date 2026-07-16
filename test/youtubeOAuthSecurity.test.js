import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const [socialSource, stateSource, libSource, modalSource, tauriConfig] = await Promise.all([
    readFile(new URL("../src-tauri/src/commands/social_upload.rs", import.meta.url), "utf8"),
    readFile(new URL("../src-tauri/src/state.rs", import.meta.url), "utf8"),
    readFile(new URL("../src-tauri/src/lib.rs", import.meta.url), "utf8"),
    readFile(new URL("../app/windows/exporter/components/SocialUploadModal.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src-tauri/tauri.conf.json", import.meta.url), "utf8").then(JSON.parse),
])

test("YouTube credentials and tokens stay in native session memory", () => {
    assert.match(stateSource, /struct YoutubeOAuthSession/)
    assert.match(stateSource, /youtube_oauth: YoutubeOAuthSession/)
    assert.match(socialSource, /session\.set_credentials\(credentials\)/)
    assert.match(socialSource, /session\.commit_tokens\(expected_generation, tokens\)/)
    assert.doesNotMatch(socialSource, /store\.set\(/)
    assert.doesNotMatch(socialSource, /serde_json::to_value/)
    assert.doesNotMatch(stateSource, /derive\([^)]*Serialize[^)]*\)\]\s*pub\(crate\) struct YoutubeOAuth/)
})

test("legacy plaintext is scrubbed before any renderer is shown", () => {
    const mainWindow = tauriConfig.app.windows.find(window => window.label === "main")
    const migration = libSource.indexOf("migrate_legacy_youtube_auth(&app_handle)")
    const rendererBuild = libSource.indexOf("WebviewWindowBuilder::from_config", migration)

    assert.equal(mainWindow?.create, false, "configured windows must not create a renderer before setup")
    assert.ok(migration >= 0, "startup must invoke the legacy YouTube migration")
    assert.ok(rendererBuild > migration, "migration must run before renderer creation")
    assert.match(socialSource, /store\.delete\(YOUTUBE_TOKENS_KEY\)/)
    assert.match(socialSource, /store\.delete\(YOUTUBE_CREDENTIALS_KEY\)/)
    assert.match(libSource, /return Err\(Box::new\(error\)\)/)
})

test("disconnect and exit invalidate every session secret", () => {
    const disconnect = socialSource.slice(
        socialSource.indexOf("pub async fn youtube_auth_disconnect"),
        socialSource.indexOf("pub async fn youtube_upload_video"),
    )

    assert.match(disconnect, /YoutubeOAuthSession::clear/)
    assert.match(disconnect, /revoke_tokens\(&tokens\)\.await/)
    assert.match(disconnect, /migrate_legacy_youtube_auth\(&app\)/)
    assert.match(libSource, /clear_youtube_oauth_session\(app_handle\)/)
    assert.match(stateSource, /self\.advance_generation\(\);\s*self\.credentials = None;\s*self\.tokens\.take\(\)/)
})

test("stale OAuth work cannot restore tokens after disconnect", () => {
    assert.match(stateSource, /self\.generation != expected_generation/)
    assert.match(socialSource, /Err\(stale_tokens\) => \{\s*revoke_tokens\(&stale_tokens\)\.await/)
    assert.match(socialSource, /authorization changed while the token was refreshing/)
})

test("status completion is rebound to the current native authorization generation", () => {
    const status = socialSource.slice(
        socialSource.indexOf("pub async fn youtube_auth_status"),
        socialSource.indexOf("pub async fn youtube_auth_disconnect"),
    )

    assert.match(stateSource, /pub\(crate\) fn status_snapshot\(&self\) -> \(u64, bool, bool\)/)
    assert.match(status, /status_generation/)
    assert.match(status, /current_generation != status_generation/)
    assert.match(status, /channel_name = None/)
})

test("provider failures cannot expose response bodies or the resumable capability URL", () => {
    const upload = socialSource.slice(
        socialSource.indexOf("pub async fn youtube_upload_video"),
        socialSource.indexOf("#[cfg(test)]"),
    )

    assert.doesNotMatch(socialSource, /(?:resp|init_resp)\.text\(\)\.await/)
    assert.doesNotMatch(upload, /\.send\(\)\s*\.await\?/)
    assert.match(upload, /YouTube upload request failed/)
    assert.match(upload, /YouTube rejected an upload chunk/)
    assert.doesNotMatch(upload, /"error": format!\(/)
})

test("renderer status is non-secret and the UI explains session-only behavior", () => {
    const status = socialSource.slice(
        socialSource.indexOf("pub async fn youtube_auth_status"),
        socialSource.indexOf("pub async fn youtube_auth_disconnect"),
    )

    assert.match(status, /"hasCredentials": has_credentials/)
    assert.match(status, /"connected": connected/)
    assert.match(status, /"channelName": channel_name/)
    assert.doesNotMatch(status, /access_token|refresh_token|client_secret/)
    assert.match(modalSource, /keeps these credentials and YouTube tokens in native memory only/)
    assert.match(modalSource, /enter them again after restart or disconnect/)
    assert.match(modalSource, /Use for this session/)
    assert.match(modalSource, /setClientSecret\(""\)/)
})
