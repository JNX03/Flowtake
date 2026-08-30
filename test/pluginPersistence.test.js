import assert from "node:assert/strict"
import test from "node:test"
import { selectPersistedShape } from "../app/shared/redux/pluginSlice.js"

test("persisted plugin settings keep a stable selector result", () => {
    const plugin = {
        enabled: { appRecording: false },
        config: { appRecording: { windowIds: [] } },
    }
    const state = { plugin }

    const first = selectPersistedShape(state)
    const second = selectPersistedShape(state)

    assert.strictEqual(second, first)
    assert.deepEqual(first, {
        enabled: plugin.enabled,
        config: plugin.config,
    })

    const changed = selectPersistedShape({
        plugin: { ...plugin, enabled: { appRecording: true } },
    })
    assert.notStrictEqual(changed, first)
})
