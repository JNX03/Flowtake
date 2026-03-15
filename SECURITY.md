# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.23.x  | Yes       |
| < 1.23  | No        |

Only the latest release receives security updates. We recommend always running the most recent version.

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

- **FFmpeg Sidecar** — Flowtake bundles FFmpeg as an external binary. All FFmpeg commands are constructed server-side in Rust to prevent command injection.
- **IPC Boundary** — Frontend-to-backend communication uses Tauri's typed command system. All inputs are validated on the Rust side.
- **File Access** — The application accesses the filesystem for project files, recordings, and exports. File paths are validated and scoped.
- **No Network by Default** — Core recording/editing functionality works entirely offline. Network access is only used for update checks and license validation.
- **Content Security Policy** — The frontend enforces a strict CSP to prevent XSS attacks.
- **Video Protocol** — The custom `video://` protocol handler validates and scopes all file access to known recording paths.

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
- Issues in third-party dependencies (report upstream; notify us if it affects Flowtake)
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
