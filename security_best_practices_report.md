# Flowtake security best-practices review

Reviewed 2026-07-16 against the current Tauri, React/JavaScript, Rust, and GitHub Actions implementation. Findings are ordered by severity. Fixed findings have regression coverage; remaining findings are explicit release gates.

## Fixed — native updater download and execution boundary removed (critical)

**Evidence:** `src-tauri/src/commands/app.rs`, `app/shared/tauriBridge.js`, the updater UI components, `src-tauri/capabilities/default.json`, `test/updatesSettings.test.js`, and `test/nativeCapabilitySecurity.test.js`.

The renderer previously supplied arbitrary URL, version, and local-path values to native updater commands. A compromised renderer could therefore ask the privileged backend to download or execute attacker-controlled content.

Native automatic installer download and launch are now disabled for this release. The Tauri command registry and renderer bridge expose only a metadata check and a no-argument manual action. Metadata is fetched from the exact HTTPS `api.github.com/repos/JNX03/Flowtake/releases/latest` endpoint. The manual action owns the exact `https://github.com/JNX03/Flowtake/releases/latest` destination in Rust; the renderer cannot provide a URL or local path. Download, pending-installer, launch, progress, restart, and process-exit command surfaces and state wiring are removed. Flowtake neither stores nor executes an update artifact.

**Verification:** focused Rust endpoint/version tests and Node command-surface regressions cover the manual-only boundary. The final full-suite results are recorded below.

## Fixed — renderer-controlled project/render path traversal and media mutation (critical)

**Evidence:** `src-tauri/src/identifiers.rs`, `src-tauri/src/commands/projects.rs`, `src-tauri/src/commands/files.rs`, `src-tauri/src/commands/exporter.rs`, `src-tauri/src/commands/store.rs`, `src-tauri/src/lib.rs`, and `test/nativePathSecurity.test.js`.

Project IDs, render IDs, imported archive paths, and media access modes previously crossed the renderer/native boundary with insufficient backend ownership. A compromised renderer could use crafted identifiers or paths to escape a project root, forge project-library state, resolve an unregistered render directory, or truncate source media through a write-capable file handle.

Project IDs must now be exact canonical UUIDs and render IDs must be `render-<canonical UUID>`. Project archives, temp directories, delete operations, custom-protocol media, backgrounds, and export workspaces are derived from validated backend state rather than renderer paths. Imports copy a user-selected archive into a newly generated backend project ID. Render files resolve only from the registered render map. Renderer writes cannot replace the backend-owned project library. Symlinks and unsupported entries are rejected while copying render inputs. Source media types are read-only, render output is write-only, `rw`/`r+` are rejected, read ranges are bounded to 64 MiB, and unknown video types fail closed.

**Verification:** identifier, deletion-sentinel, registered-render, and least-privilege file-mode Rust tests passed; five native-path Node regressions passed.

## Fixed — renderer access to native secrets, filesystem paths, and process execution (high)

**Evidence:** `src-tauri/capabilities/default.json`, `src-tauri/tauri.conf.json`, `src-tauri/src/lib.rs`, `app/windows/pickerImage.js`, `package.json`, and `test/nativeCapabilitySecurity.test.js`.

The main and auxiliary webviews previously received the complete Tauri store API, broad filesystem reads, and shell execution. A compromised renderer could read or replace `social_auth.json`, inspect unrelated user files, or invoke powerful native operations. Production DevTools, `core:default`, image-from-path, and broad asset-protocol scope also enlarged the renderer boundary.

Renderer `store:*`, `fs:*`, and `shell:*` permissions are removed, along with `core:default`, image-from-path, webview creation, arbitrary window creation, and unused JS filesystem, shell, store, and updater packages. Production windows explicitly disable DevTools. The asset protocol is limited to Flowtake's app temp and export locations. Picker images fail closed unless the backend supplies an `image/*` data URL. Backend-only Rust store and sidecar operations remain available without exposing their plugin commands to the webview.

**Verification:** capability and package regressions passed; the final full-suite results are recorded below.

## Fixed — OAuth callback CSRF and authorization-code interception (high)

**Evidence:** `src-tauri/src/commands/social_upload.rs` and its unit tests.

The YouTube desktop OAuth flow did not bind the callback to the initiating request. It now creates a cryptographically random one-time state, uses S256 PKCE and sends the `code_verifier` at exchange, and strictly validates method, HTTP version, root path, exact loopback host, unambiguous parameters, encoding, request size, and partial reads. Invalid requests receive generic responses and do not disclose codes or state.

**Verification:** six focused tests passed, including the RFC 7636 vector and wrong-state/malformed-callback cases.

## Fixed — mutable release inputs and release-target drift (high)

**Evidence:** `.github/workflows/main.yml` and `test/releaseWorkflow.test.js`.

The release workflow used mutable FFmpeg aliases without a cryptographic integrity gate and could rebuild a moving tag target across jobs. Windows now uses BtbN's retained `autobuild-2026-06-30-13-34`; Linux uses the versioned John Van Sickle 7.0.2 archive; macOS uses eugeneware b6.0. Every platform downloads with fail-on-HTTP-error behavior and verifies a pinned SHA-256 value before extraction. All build and publish jobs check out the commit validated from the release tag, the validator requires that commit to be contained in `origin/main`, and the publisher re-verifies the tag-to-commit binding immediately before creating a release. An exact-commit quality gate runs the full Node suite, explicit release/security regressions, lint, frontend build, Cargo check, Rust unit tests, and clippy before any platform build can begin; the publisher also directly requires that gate to succeed. The publisher stages only the explicit artifact whitelist into a collision-checked flat directory, generates and verifies a basename-compatible `SHA256SUMS.txt`, and publishes exactly that directory. Tag pushes and manual dispatches for the same tag share one concurrency key. Actions are pinned to full commit SHAs and only the publisher receives `contents: write`. The Pages workflow is manual, rejects dispatches outside `refs/heads/main`, and refuses to deploy until GitHub's latest release matches the repository version and includes `SHA256SUMS.txt`.

## Fixed — Rust dependency advisories and missing continuous audit gate (high)

**Evidence:** `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`, `scripts/run-cargo-audit.sh`, `.github/workflows/ci.yml`, `.github/workflows/main.yml`, `.github/workflows/rust-security-audit.yml`, `test/nativePathSecurity.test.js`, and `test/releaseWorkflow.test.js`.

The branch originally retained vulnerable `anyhow`, `quick-xml`, `quinn-proto`, `serde_with`, and `cmov` lockfile entries, while normal CI did not run RustSec. The lockfile now resolves `anyhow 1.0.103`, `quick-xml 0.41.0` through `plist 1.10.0`, `quinn-proto 0.11.15`, and `serde_with 3.21.0`; the unused `notify-rust` subtree was removed. Flowtake writes its own project archives with `CompressionMethod::Stored`, so the `zip` dependency now disables its broad default encryption and codec set. This removes the unused, yanked `aes 0.9.0` chain and twenty additional codec/cryptography packages without changing Flowtake-produced archive compatibility. Externally recompressed project archives are not a supported compatibility promise and may now be rejected.

The audit runner downloads the official `cargo-audit 0.22.2` x86_64 Linux asset over HTTPS with bounded retries, verifies the pinned SHA-256 before extracting exactly the expected member, and runs from an empty working directory and `CARGO_HOME` so repository or runner advisory-ignore configuration cannot be inherited. It has no advisory ignores or best-effort fallback. The gate is mandatory in pull-request CI and the exact validated release commit, and a minimal-permission workflow audits the current `main` branch every day and on every manual dispatch. A fresh local audit scanned 601 lockfile dependencies with zero vulnerabilities and 18 visible unsound/unmaintained warnings; no warning or advisory is suppressed.

## Fixed — arbitrary native URL-handler invocation (medium)

**Evidence:** `src-tauri/src/commands/exporter.rs` and its unit tests.

The renderer-controlled `open_url_in_browser` command previously forwarded any string to the operating system, including local files, executables, and custom URL handlers. It now accepts only credential-free HTTPS URLs, plus the exact Screen Recording settings URI on macOS. Three unit tests cover accepted HTTPS URLs and rejected HTTP, `file:`, `javascript:`, `data:`, executable paths, credentials, and arbitrary custom schemes.

## Fixed — live-stream FFmpeg target injection, arbitrary output, and unbounded input (high)

**Evidence:** `src-tauri/src/commands/live.rs`, `src-tauri/src/state.rs`, `src-tauri/src/commands/store.rs`, `app/windows/liveComposer/composer.jsx`, `app/windows/main/components/settings/liveSettingsStore.js`, and `test/liveStreamingSecurity.test.js`.

Live streaming previously accepted a renderer-controlled output directory and unrestricted FFmpeg destination text, interpolated remote and local targets into a tee muxer string, buffered input through an unbounded channel, and persisted the stream key in generic renderer-readable settings. A compromised renderer could write arbitrary user files, select unsafe FFmpeg protocols or local targets, inject another tee output, exhaust memory, or recover a reusable streaming credential later.

The backend now accepts only public `rtmp`/`rtmps` destinations; rejects credentials, control/whitespace and tee grammar, local/private/reserved literal IPs, ambiguous local hostnames, and invalid numeric limits; derives unique local recordings under `Videos/Flowtake`; and percent-encodes the backend path before composing exactly one tee separator. Input chunks are capped at 4 MiB and use a bounded eight-item channel with explicit backpressure. Concurrent starts serialize across the FFmpeg spawn boundary. Stream keys are rejected from deserialized renderer config, validated by a write-only native command, retained only in process memory, and exposed to the renderer as a boolean status. Generic settings strip and migrate legacy `streamKey` values. Tauri's declarative main-window creation is disabled; startup fails closed while scrubbing the legacy key and only then constructs the renderer.

**Verification:** nine live-stream security Rust tests, the generic-store migration test, and six Node boundary regressions passed.

## Fixed — live-overlay capability and window-destruction mismatch (high)

**Evidence:** `src-tauri/capabilities/live-overlay.json`, `src-tauri/src/commands/windows.rs`, and `test/liveOverlaySecurity.test.js`.

The native live overlay previously had no matching capability declaration even though it listens for and emits Tauri events, and its close path invoked a command that always destroyed the main window. The overlay now receives a dedicated capability containing only the three event operations it uses. The destruction command accepts Tauri's injected invoking `WebviewWindow` and destroys that caller, so an overlay close cannot terminate the main application window.

**Verification:** two focused source regressions validate the exact capability set, exclusion from the default capability, and self-bound destruction. The full Node suite and locked Cargo check pass.

## Fixed — plaintext YouTube OAuth credential and token persistence (high)

**Evidence:** `src-tauri/src/commands/social_upload.rs`, `src-tauri/src/state.rs`, `src-tauri/src/lib.rs`, `app/windows/exporter/components/SocialUploadModal.jsx`, and `test/youtubeOAuthSecurity.test.js`.

YouTube client credentials plus access and refresh tokens were previously serialized to `social_auth.json`. They now live only in a native `AppState` session that has no renderer-readable value getter. Generation binding prevents an OAuth exchange or refresh that finishes after disconnect or credential replacement from restoring a stale token; stale results are revoked. Disconnect clears credentials and tokens before its revocation request, and process exit explicitly clears the session. Tauri's configured main window has `create: false`; startup deletes both legacy JSON keys and fails closed if that migration cannot be saved before explicitly constructing any renderer. Credential replacement and disconnect also repeat the legacy scrub defensively. Provider error bodies and the resumable upload capability URL are redacted at the native boundary.

The UI clears its credential fields after handoff and tells users that credentials and authorization must be re-entered after restart or disconnect. This is an intentional security-versus-convenience tradeoff; a future OS-keychain implementation may add persistent sign-in without returning to plaintext storage.

**Verification:** seven focused source regressions cover session-only storage, pre-renderer fail-closed startup migration, disconnect/exit cleanup, stale-work invalidation, status-generation rebinding, provider-error redaction, and the non-secret renderer/UI surface. A native unit regression covers generation replacement and full-session clearing.

## Fixed — default-branch gates are repository-enforced (medium)

**Evidence:** the GitHub branch-protection and repository-rulesets APIs for `JNX03/Flowtake`.

`main` now requires an up-to-date pull request with successful Frontend Quality, Rust Security Audit, Windows/macOS/Linux Rust, and GitGuardian checks. The rule is enforced for administrators, requires resolved review conversations, and disables force pushes and branch deletion. The approving-review count is intentionally zero for the current solo-maintainer repository, but direct merges or pushes cannot bypass the required checks.

## Open — CSP grants broad script/network capability (medium)

**Evidence:** `src-tauri/tauri.conf.json` and `index.html`.

The document policy includes `unsafe-inline`, the HTML policy additionally includes `unsafe-eval`, and connection policy permits broad HTTP/HTTPS/WebSocket destinations. This increases the consequence of an injection bug. Inventory the exact libraries that need WebAssembly/eval, move inline boot code and styles to hashed or local files, replace broad schemes with explicit hosts or feature-scoped Tauri commands, and exercise capture/export/social flows under the tighter policy before release.

## Open — platform code signing and customer install trust (medium)

**Evidence:** `src-tauri/tauri.conf.json` has no platform signing identity; updater signing does not replace Windows Authenticode or Apple notarization.

Unsigned desktop installers create warning-heavy acquisition and weaken publisher identity. A paid launch should either obtain platform signing/notarization or clearly label early builds as preview artifacts, publish SHA-256 values and provenance, and avoid claiming OS-verified publisher trust.

## Open — transitive Rust maintenance and unsoundness warnings (medium)

**Evidence:** the current `cargo-audit 0.22.2` output and `cargo tree --locked --target all`.

RustSec reports 18 non-vulnerability warnings that remain intentionally visible: the GTK3 binding family is unmaintained, `glib 0.18.5` has an unsound `VariantStrIter` implementation, and `fxhash`, `proc-macro-error`, plus five `unic` crates are unmaintained. The GTK/glib path is owned by Tauri's Linux WebKit stack, while the other paths are build/transitive utilities; neither Flowtake nor the inspected Tauri/wry/GTK paths call the affected glib iterator. Do not add audit ignores. Track upstream Tauri/WebKit migration and re-evaluate each warning on dependency updates; treat any future RustSec vulnerability classification as a release-blocking failure.

## Corrected documentation drift (low)

`SECURITY.md` claimed network access for license validation although Flowtake has no license-validation feature. The statement now names only explicit update and user-initiated connected services, preserving the open-source boundary.

## Final verification snapshot

- Rust: 67 passed, 0 failed, 1 environment-dependent ignored.
- Node: 117 passed, 0 failed.
- Locked `cargo check`: passed.
- `cargo clippy --all-targets -- -D warnings`: passed.
- RustSec: 601 dependencies scanned, 0 vulnerabilities, 18 visible maintenance/unsoundness warnings.
- npm audit: 0 production or development dependency vulnerabilities.
- Frontend production build: passed.
- ESLint: 0 errors and 41 existing warnings.
- Marketing-site production build: passed.
- JSON configuration parsing, four-workflow YAML parsing, audit-script syntax, and `git diff --check`: passed.

## Release decision

The critical updater boundary is resolved by removing native installer handling; native path boundaries, release-workflow and dependency-advisory integrity, renderer entitlement reduction, OAuth callback and token-storage boundaries, URL-handler boundary, and live-stream output/input boundary are resolved. YouTube upload now uses an intentionally session-only authorization model; persistent sign-in would still require OS-backed secret storage. Keep CSP reduction, platform signing, and the visible transitive Rust maintenance warnings as tracked desktop-release gates, and label manually downloaded unsigned installers clearly.
