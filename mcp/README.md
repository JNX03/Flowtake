# Flowtake Local Editor MCP

Flowtake includes a free, local Model Context Protocol server for AI-assisted,
backup-backed timeline editing. It reads and updates Flowtake project metadata;
recording media stays on the computer and the server has no HTTP transport or
upload code.

The server uses the official
[`@modelcontextprotocol/server`](https://github.com/modelcontextprotocol/typescript-sdk/tree/main/packages/server)
v2 package and its local stdio transport. Node.js 20 or newer is required.

This first MCP release is a **source-checkout/developer integration**. Flowtake's
current MSI, DMG, and Linux packages do not bundle Node.js or the `mcp/` source,
so installing the desktop app alone does not install this server. Clone the
repository and install its npm dependencies as shown below.

## Install and run

From the Flowtake repository:

```powershell
npm install
npm run mcp
```

With no arguments, the server finds the normal Flowtake application-data
directory for the current operating system. A portable or development setup can
use explicit directories:

```powershell
npm run mcp -- --projects-dir "D:\FlowtakeData\projects" --temp-dir "D:\FlowtakeData\temp"
```

`--temp-dir` defaults to the `temp` directory beside `projects`. Backups default
to `.flowtake-mcp-backups` inside the configured projects directory. A custom
`--backup-dir` is accepted only when it remains inside the projects allowlist.

Copy [examples/mcp-config.json](examples/mcp-config.json), replace its neutral
placeholder paths, and add the resulting `flowtake` entry to any MCP host that
supports local stdio servers. The host starts the process; do not start a second
copy yourself.

The official MCP Inspector can also exercise the server:

```powershell
npx @modelcontextprotocol/inspector node mcp/server.mjs --projects-dir "D:\FlowtakeData\projects"
```

## Tools

| Tool | Capability |
| --- | --- |
| `flowtake_list_projects` | Lists relative project references, revisions, counts, and archive/open-workspace status. Project names require `includeNames: true`. |
| `flowtake_project_summary` | Summarizes duration, sources, canvas metadata, row counts, and validation warnings. |
| `flowtake_get_timeline` | Reads a bounded timeline range. Caption text is private-by-default and requires `includeText: true`. |
| `flowtake_split_item` | Splits a clip, caption, audio item, non-video overlay, or mask through Flowtake's command planner. |
| `flowtake_trim_item` | Moves an item's in/out points inward while preserving clip/audio source timing; video overlays fail safely. |
| `flowtake_delete_item` | Deletes one item, optionally using Flowtake's validated same-lane ripple behavior. |
| `flowtake_add_captions` | Adds up to 200 timed captions with optional built-in entrance and exit effects. |
| `flowtake_update_caption` | Updates caption text, timing, or built-in effects. |

All times are milliseconds. Read tools return a 64-character `revision`. Every
edit must send that exact value as `expectedRevision`; stale edits fail instead
of overwriting newer work. Use `dryRun: true` to preview a validated edit. A real
write also requires `flowtakeClosed: true`.

Recommended agent workflow:

1. Call `flowtake_list_projects`.
2. Call `flowtake_project_summary` and `flowtake_get_timeline` for the selected project.
3. Preview a write with `dryRun: true`.
4. Ask the user to close the Flowtake project.
5. Re-read it, then write with the new revision and `flowtakeClosed: true`.
6. Open the project in Flowtake to review and export.

## Local safety and privacy

- One configured projects directory is the filesystem allowlist. Absolute paths,
  traversal, symlink project references, and backup paths outside it are rejected.
- Durable projects are ZIP archives. If Flowtake has an extracted
  `temp/<project-id>` workspace, every archive write fails closed because closing
  the app would otherwise overwrite the MCP edit. Close the project normally,
  re-read it, and retry. If the app crashed, reopen and close the project to clear
  a stale workspace.
- A dry run may inspect the last saved archive while its Flowtake workspace is
  open, but returns a warning because unsaved editor state is not included.
  Close the project and re-read its revision before the real write.
- Writes are serialized, revision-checked again immediately before replacement,
  saved to a same-directory temporary file, atomically renamed, and read back for
  verification.
- Every successful archive write first creates a timestamped, byte-for-byte ZIP
  backup with all media. Extracted `project.json` references receive a manifest
  backup. Full archive backups favor recoverability and require roughly another
  archive's worth of disk space; they are not deleted automatically and cannot
  themselves be targeted by MCP editing tools.
- ZIP repacking streams individual files, so video bytes are not accumulated in
  memory. Before replacement, every non-manifest file is matched by path, size,
  and CRC against the original. Repacking also temporarily needs enough disk
  space to extract and repack the project.
- The MCP server itself makes no network requests. The configured MCP host and
  model may receive tool results; project names and caption text are therefore
  omitted unless explicitly requested. Choose a host/provider whose privacy
  policy fits the recording.

## Current limits

This MCP surface edits Flowtake's project timeline; it does not inspect video
pixels, listen to audio, generate a transcript, render, export, upload, or control
the desktop UI. It supports the current project schema and the existing clip,
subtitle, audio, overlay, and mask rows. Splitting or trimming a video overlay is
currently rejected because the shared planner does not yet preserve its source
in-point; deleting it remains supported. Keep Flowtake closed during durable
writes, then use the desktop editor to visually review the result before export.

The MCP SDK, schema validator, and ZIP helpers used here are MIT or BSD licensed;
there is no paid tier, API key, or hosted service.
