import assert from "node:assert/strict"
import test from "node:test"
import throttle from "throttleit"

test("export progress reports immediately and publishes the latest deferred frame", t => {
    t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 10000 })
    const published = []
    const onProgress = throttle(progress => published.push(progress), 1000)

    onProgress(0)
    assert.deepEqual(published, [0])
    t.mock.timers.tick(100)
    onProgress(25)
    t.mock.timers.tick(100)
    onProgress(75)
    t.mock.timers.tick(799)
    assert.deepEqual(published, [0])
    t.mock.timers.tick(1)
    assert.deepEqual(published, [0, 75])
    t.mock.timers.tick(1000)
    assert.deepEqual(published, [0, 75])
})

test("camera synchronization reads the current screen time when its deferred update runs", t => {
    t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 10000 })
    const screen = { currentTime: 1 }
    const camera = { currentTime: 0 }
    const onTimeUpdate = throttle(() => {
        if (Math.abs(screen.currentTime - camera.currentTime) > 0.15)
            camera.currentTime = screen.currentTime
    }, 200)

    onTimeUpdate()
    assert.equal(camera.currentTime, 1)
    t.mock.timers.tick(50)
    screen.currentTime = 1.4
    onTimeUpdate()
    t.mock.timers.tick(50)
    screen.currentTime = 1.8
    onTimeUpdate()
    assert.equal(camera.currentTime, 1)
    t.mock.timers.tick(100)
    assert.equal(camera.currentTime, 1.8)
})
