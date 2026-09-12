#!/usr/bin/env node

import { homedir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { McpServer } from "@modelcontextprotocol/server"
import { serveStdio } from "@modelcontextprotocol/server/stdio"
import * as z from "zod/v4"
import {
    addFlowtakeCaptions,
    deleteFlowtakeItem,
    EDITABLE_ROWS,
    FlowtakeEditError,
    getFlowtakeProjectSummary,
    getFlowtakeTimeline,
    listFlowtakeProjects,
    splitFlowtakeItem,
    toMcpError,
    trimFlowtakeItem,
    updateFlowtakeCaption,
} from "./src/flowtakeEditing.mjs"
import { FlowtakeProjectStore } from "./src/projectStore.mjs"

const EFFECT_TYPES = [
    "none",
    "fade",
    "typewriter",
    "slide-up",
    "slide-down",
    "bounce",
    "scale",
]

const projectRefSchema = z.string().trim().min(1).max(512)
    .describe("Relative project reference returned by flowtake_list_projects")
const revisionSchema = z.string().regex(/^[a-f0-9]{64}$/i)
    .describe("Exact revision returned by the most recent read tool")
const rowSchema = z.enum(EDITABLE_ROWS)
const effectSchema = z.object({
    type: z.enum(EFFECT_TYPES),
    duration: z.number().int().min(0).max(5000),
}).strict()
const writeSafetySchema = {
    expectedRevision: revisionSchema,
    flowtakeClosed: z.boolean().describe(
        "Confirm the Flowtake desktop app is closed so it cannot overwrite this project archive",
    ),
    dryRun: z.boolean().optional().default(false)
        .describe("Validate and preview the edit without writing or creating a backup"),
}

function defaultProjectsDirectory() {
    const environment = globalThis.process.env
    if (environment.FLOWTAKE_PROJECTS_DIR?.trim()) {
        return path.resolve(environment.FLOWTAKE_PROJECTS_DIR)
    }

    if (globalThis.process.platform === "win32") {
        return path.join(environment.APPDATA ?? homedir(), "com.flowtake.desktop", "projects")
    }
    if (globalThis.process.platform === "darwin") {
        return path.join(homedir(), "Library", "Application Support", "com.flowtake.desktop", "projects")
    }
    return path.join(
        environment.XDG_DATA_HOME ?? path.join(homedir(), ".local", "share"),
        "com.flowtake.desktop",
        "projects",
    )
}

export function parseServerOptions(argv = globalThis.process.argv.slice(2)) {
    let projectsDirectory = defaultProjectsDirectory()
    let backupDirectory
    let tempDirectory

    const nextValue = (name, index) => {
        const value = argv[index + 1]
        if (!value?.trim() || value.startsWith("--")) throw new Error(`${name} requires a directory`)
        return value
    }

    for (let index = 0; index < argv.length; index += 1) {
        const argument = argv[index]
        if (argument === "--projects-dir") {
            projectsDirectory = path.resolve(nextValue(argument, index))
            index += 1
        } else if (argument.startsWith("--projects-dir=")) {
            const value = argument.slice("--projects-dir=".length)
            if (!value.trim()) throw new Error("--projects-dir requires a directory")
            projectsDirectory = path.resolve(value)
        } else if (argument === "--backup-dir") {
            backupDirectory = path.resolve(nextValue(argument, index))
            index += 1
        } else if (argument.startsWith("--backup-dir=")) {
            const value = argument.slice("--backup-dir=".length)
            if (!value.trim()) throw new Error("--backup-dir requires a directory")
            backupDirectory = path.resolve(value)
        } else if (argument === "--temp-dir") {
            tempDirectory = path.resolve(nextValue(argument, index))
            index += 1
        } else if (argument.startsWith("--temp-dir=")) {
            const value = argument.slice("--temp-dir=".length)
            if (!value.trim()) throw new Error("--temp-dir requires a directory")
            tempDirectory = path.resolve(value)
        } else {
            throw new Error(`Unknown Flowtake MCP option: ${argument}`)
        }
    }
    if (!projectsDirectory) throw new Error("--projects-dir requires a directory")
    return { projectsDirectory, backupDirectory, tempDirectory }
}

function textResult(value) {
    return {
        content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
        structuredContent: value,
    }
}

function errorResult(error) {
    console.error("Flowtake MCP tool error:", error)
    return {
        content: [{ type: "text", text: JSON.stringify(toMcpError(error), null, 2) }],
        isError: true,
    }
}

function requireClosedForWrite(args) {
    if (!args.dryRun && args.flowtakeClosed !== true) {
        throw new FlowtakeEditError(
            "flowtake-must-be-closed",
            "Close Flowtake before writing a durable project archive, then call again with flowtakeClosed: true. Use dryRun for a no-write preview.",
        )
    }
}

function registerTool(server, name, config, handler) {
    server.registerTool(name, config, async args => {
        try {
            return textResult(await handler(args))
        } catch (error) {
            return errorResult(error)
        }
    })
}

export function createFlowtakeMcpServer({ store }) {
    const server = new McpServer(
        { name: "flowtake-local-editor", version: "1.0.0" },
        {
            instructions: [
                "This server edits Flowtake projects locally and never uploads media.",
                "Call flowtake_list_projects and a read tool before editing; pass the exact returned revision.",
                "Prefer dryRun first for destructive edits.",
                "Close the Flowtake desktop app before any write so its in-memory state cannot overwrite the archive.",
                "Request caption text only when it is necessary, because timeline text can contain private material.",
            ].join(" "),
        },
    )

    registerTool(server, "flowtake_list_projects", {
        title: "List local Flowtake projects",
        description: "List Flowtake projects inside the configured local allowlist. Returns only relative references and metadata, never media or absolute paths.",
        inputSchema: z.object({
            limit: z.number().int().min(1).max(500).optional().default(100),
            includeNames: z.boolean().optional().default(false)
                .describe("Include project names; disabled by default because names may contain private client information"),
        }).strict(),
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    }, args => listFlowtakeProjects(store, args))

    registerTool(server, "flowtake_project_summary", {
        title: "Summarize a Flowtake project",
        description: "Read project duration, source types, timeline counts, schema version, and validation warnings without returning local paths.",
        inputSchema: z.object({
            projectRef: projectRefSchema,
            includeName: z.boolean().optional().default(false)
                .describe("Include the project name; disabled by default because it may contain private client information"),
        }).strict(),
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    }, args => getFlowtakeProjectSummary(store, args.projectRef, {
        includeName: args.includeName,
    }))

    registerTool(server, "flowtake_get_timeline", {
        title: "Inspect a Flowtake timeline",
        description: "Read a bounded timeline range. Caption text is omitted by default for privacy and must be requested explicitly.",
        inputSchema: z.object({
            projectRef: projectRefSchema,
            rows: z.array(rowSchema).min(1).max(EDITABLE_ROWS.length).optional(),
            startMs: z.number().min(0).optional().default(0),
            endMs: z.number().positive().nullable().optional().default(null),
            includeText: z.boolean().optional().default(false),
            limit: z.number().int().min(1).max(500).optional().default(200),
        }).strict(),
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    }, args => getFlowtakeTimeline(store, args))

    registerTool(server, "flowtake_split_item", {
        title: "Split a Flowtake timeline item",
        description: "Backup-backed split of one clip, caption, audio, non-video overlay, or mask at an exact millisecond using Flowtake's own command planner. Video overlays are rejected because their source in-point is not yet planner-safe.",
        inputSchema: z.object({
            projectRef: projectRefSchema,
            row: rowSchema,
            itemId: z.string().trim().min(1).max(128),
            splitAtMs: z.number().min(0),
            newItemId: z.string().trim().min(1).max(128).optional(),
            minSegmentDurationMs: z.number().min(0).max(60000).optional().default(100),
            ...writeSafetySchema,
        }).strict(),
        annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    }, args => {
        requireClosedForWrite(args)
        return splitFlowtakeItem(store, args)
    })

    registerTool(server, "flowtake_trim_item", {
        title: "Trim a Flowtake timeline item",
        description: "Shorten one timeline item by moving its start and/or end inward. Source in/out timing is preserved for clips and audio; video overlays are rejected until their source in-point is planner-safe.",
        inputSchema: z.object({
            projectRef: projectRefSchema,
            row: rowSchema,
            itemId: z.string().trim().min(1).max(128),
            startMs: z.number().min(0).optional(),
            endMs: z.number().positive().optional(),
            ...writeSafetySchema,
        }).strict().refine(args => args.startMs !== undefined || args.endMs !== undefined, {
            message: "Provide startMs and/or endMs",
        }),
        annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
    }, args => {
        requireClosedForWrite(args)
        return trimFlowtakeItem(store, args)
    })

    registerTool(server, "flowtake_delete_item", {
        title: "Delete a Flowtake timeline item",
        description: "Delete one timeline item. Optional ripple mode closes later time in the same lane after Flowtake validates locks and collisions.",
        inputSchema: z.object({
            projectRef: projectRefSchema,
            row: rowSchema,
            itemId: z.string().trim().min(1).max(128),
            ripple: z.boolean().optional().default(false),
            ...writeSafetySchema,
        }).strict(),
        annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
    }, args => {
        requireClosedForWrite(args)
        return deleteFlowtakeItem(store, args)
    })

    registerTool(server, "flowtake_add_captions", {
        title: "Add captions to a Flowtake project",
        description: "Add up to 200 local captions with timing, text, and optional entrance/exit effects. Overlap is preserved intentionally.",
        inputSchema: z.object({
            projectRef: projectRefSchema,
            captions: z.array(z.object({
                id: z.string().trim().min(1).max(128).optional(),
                startMs: z.number().min(0),
                endMs: z.number().positive(),
                text: z.string().trim().min(1).max(2000),
                entranceEffect: effectSchema.optional(),
                exitEffect: effectSchema.optional(),
            }).strict()).min(1).max(200),
            ...writeSafetySchema,
        }).strict(),
        annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    }, args => {
        requireClosedForWrite(args)
        return addFlowtakeCaptions(store, args)
    })

    registerTool(server, "flowtake_update_caption", {
        title: "Update a Flowtake caption",
        description: "Update the text, timing, or effects of one existing caption without touching media.",
        inputSchema: z.object({
            projectRef: projectRefSchema,
            itemId: z.string().trim().min(1).max(128),
            text: z.string().trim().min(1).max(2000).optional(),
            startMs: z.number().min(0).optional(),
            endMs: z.number().positive().optional(),
            entranceEffect: effectSchema.optional(),
            exitEffect: effectSchema.optional(),
            ...writeSafetySchema,
        }).strict().refine(args => [
            args.text,
            args.startMs,
            args.endMs,
            args.entranceEffect,
            args.exitEffect,
        ].some(value => value !== undefined), { message: "Provide at least one caption change" }),
        annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
    }, args => {
        requireClosedForWrite(args)
        return updateFlowtakeCaption(store, args)
    })

    return server
}

export function createConfiguredServer(options = parseServerOptions()) {
    const store = new FlowtakeProjectStore(options)
    return createFlowtakeMcpServer({ store })
}

if (path.resolve(globalThis.process.argv[1] ?? "") === path.resolve(fileURLToPath(import.meta.url))) {
    const options = parseServerOptions()
    const handle = serveStdio(() => createConfiguredServer(options))
    globalThis.process.on("SIGINT", () => { void handle.close() })
    globalThis.process.on("SIGTERM", () => { void handle.close() })
    console.error("Flowtake local editor MCP ready")
}
