import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { selectKeyboardLayoutDefaults } from "../app/shared/redux/keyboardLayoutSlice.js"
import { selectMouseStyleDefaults } from "../app/shared/redux/mouseStyleAnimSlice.js"

const markdownSource = await readFile(
    new URL("../app/components/MarkdownRenderer.jsx", import.meta.url),
    "utf8"
)

const makeState = ({
    mouseStyle = {},
    keyboardLayout = {},
} = {}) => ({
    undoableState: {
        present: {
            mouseStyleAnims: {
                ids: [],
                entities: {},
                color: "#ff3b30",
                showLabel: true,
                label: "FlowTake Agent",
                preset: "default",
                ...mouseStyle,
            },
            keyboardLayoutAnims: {
                ids: [],
                entities: {},
                mode: "keybinds",
                position: "bottom-center",
                size: "md",
                ...keyboardLayout,
            },
        },
    },
})

test("markdown code renderer leaves block ownership to the pre renderer", () => {
    const codeStart = markdownSource.indexOf("code:")
    const preStart = markdownSource.indexOf("pre:", codeStart)
    const codeRenderer = markdownSource.slice(codeStart, preStart)

    assert.ok(codeStart >= 0)
    assert.ok(preStart > codeStart)
    assert.match(codeRenderer, /<code/)
    assert.doesNotMatch(codeRenderer, /<pre/)
    assert.match(markdownSource.slice(preStart), /<pre/)
})

test("mouse style defaults selector preserves identity for unchanged values", () => {
    const state = makeState()
    const first = selectMouseStyleDefaults(state)
    const second = selectMouseStyleDefaults(state)
    const unrelatedState = { ...state, transientValue: true }

    assert.strictEqual(second, first)
    assert.strictEqual(selectMouseStyleDefaults(unrelatedState), first)
    assert.deepEqual(first, {
        color: "#ff3b30",
        showLabel: true,
        label: "FlowTake Agent",
        preset: "default",
    })

    assert.notStrictEqual(
        selectMouseStyleDefaults(makeState({ mouseStyle: { color: "#fff" } })),
        first
    )
})

test("keyboard layout defaults selector preserves identity for unchanged values", () => {
    const state = makeState()
    const first = selectKeyboardLayoutDefaults(state)
    const second = selectKeyboardLayoutDefaults(state)
    const unrelatedState = { ...state, transientValue: true }

    assert.strictEqual(second, first)
    assert.strictEqual(selectKeyboardLayoutDefaults(unrelatedState), first)
    assert.deepEqual(first, {
        mode: "keybinds",
        position: "bottom-center",
        size: "md",
    })

    assert.notStrictEqual(
        selectKeyboardLayoutDefaults(makeState({ keyboardLayout: { size: "lg" } })),
        first
    )
})
