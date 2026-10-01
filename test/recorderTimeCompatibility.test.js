import assert from "node:assert/strict"
import test from "node:test"
import moment from "moment"
import momentDurationFormatSetup from "moment-duration-format"

test("recorder and live overlay time stays padded and counts beyond an hour", () => {
    momentDurationFormatSetup(moment)
    for (const [milliseconds, expected] of [[0, "00:00"], [65000, "01:05"], [3600000, "60:00"], [3661000, "61:01"]]) {
        assert.equal(moment.duration(milliseconds).format("mm:ss", { trim: false }), expected)
    }
})

test("library dates retain relative and calendar display behavior", () => {
    const saved = moment.utc("2026-10-01T00:00:00Z")
    assert.equal(saved.from(moment.utc("2026-10-01T00:02:00Z")), "2 minutes ago")
    assert.equal(saved.format("YYYY-MM-DD"), "2026-10-01")
})
