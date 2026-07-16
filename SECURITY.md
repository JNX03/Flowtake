# Security Policy

## Supported Versions

| Release channel | Supported |
|-----------------|-----------|
| Latest published release | Yes |
| Earlier releases | No |

Only the latest published release receives security updates. Download it from the
[official GitHub Releases page](https://github.com/JNX03/Flowtake/releases/latest) and verify it against the
published `SHA256SUMS.txt` when that asset is available.

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

If you discover a security vulnerability in Flowtake, please report it responsibly:

### How to Report

1. **Email**: Send details to [jn03official@gmail.com](mailto:jn03official@gmail.com)
2. **Subject line**: `[SECURITY] Brief description of the vulnerability`
3. **Include**:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact assessment
   - Suggested fix (if you have one)

### What to Expect

These are response targets, not guaranteed resolution times:

| Step | Timeline |
|------|----------|
| Acknowledgment | Within 48 hours |
| Initial assessment | Within 1 week |
| Status update | Within 2 weeks |
| Fix release | Depends on severity |

### Severity Levels

| Level | Description | Target Resolution |
|-------|-------------|-------------------|
| **Critical** | Remote code execution, data exfiltration | 48 hours |
| **High** | Privilege escalation, significant data exposure | 1 week |
| **Medium** | Limited data exposure, denial of service | 2 weeks |
| **Low** | Minor information leak, hardening improvement | Next release |

## Security Considerations

### Application Architecture

Flowtake is a desktop application built with Tauri v2 and processes content locally. Key security considerations:

- **FFmpeg Sidecar** — Flowtake bundles FFmpeg as an external binary. Commands and arguments are constructed in Rust, and paths are derived from validated project/render identifiers and backend-owned roots.
- **IPC Boundary** — Frontend-to-backend communication uses Tauri commands and least-privilege window capabilities. Security-sensitive input is validated in Rust.
- **File Access** — Project files, recordings, and exports are restricted to validated project/render roots and explicitly configured asset scopes.
- **Network Behavior** — Core recording and editing work locally. The app may perform a metadata-only update check after startup; network access is also used by connected services a user explicitly starts.
- **Content Security Policy** — A CSP limits allowed sources. The current policy still permits inline styles/scripts and broad HTTPS/WebSocket connections for compatibility, so CSP reduction remains an active hardening area.
- **Video Protocol** — The custom `video://` protocol validates project identity, media kind, and file location before serving a recording.

### What We Consider In Scope

- Remote code execution via crafted project files
- Sandbox escape or privilege escalation
- Path traversal in file operations
- Command injection via FFmpeg or AHK arguments
- XSS or script injection in the renderer
- Sensitive data exposure (credentials, tokens)
- Bypass of Tauri's security model

### What We Consider Out of Scope

- Vulnerabilities requiring physical access to the device
- Social engineering attacks
- Denial of service against the local application
- Vulnerabilities that exist only in a third-party dependency and cannot affect a supported Flowtake release (report upstream; notify us if you believe Flowtake is affected)
- Vulnerabilities in outdated versions

## Security Best Practices for Contributors

If you are contributing to Flowtake, please follow these guidelines:

1. **Validate all IPC inputs** — Never trust data from the frontend. Validate and sanitize in Rust command handlers.
2. **Use parameterized commands** — Never construct shell commands with string concatenation.
3. **Scope file access** — Use Tauri's allowlist and scope configurations for filesystem access.
4. **Avoid `unsafe` Rust** — Use safe abstractions. If `unsafe` is unavoidable, document the safety invariants.
5. **Keep dependencies updated** — Run `cargo audit` and `npm audit` regularly.
6. **No secrets in code** — Never commit API keys, tokens, or credentials.

## Disclosure Policy

- We follow **coordinated disclosure** — please allow us reasonable time to fix vulnerabilities before public disclosure.
- We will credit reporters in the release notes (unless you prefer to remain anonymous).
- We will not take legal action against researchers who follow this policy.

---

Thank you for helping keep Flowtake and its users safe.
