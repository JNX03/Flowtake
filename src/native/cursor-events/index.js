"use strict"
import { EventEmitter } from "events"
import bindings from "bindings"
import os from "os"

const addon = bindings("cursor-events")
let paused = true

export default class MouseEvents extends EventEmitter {
    constructor() {
        super()

        if (os.platform() !== "win32")
            return

        let createdListener = false
        let registeredEvents = []

        this.on("newListener", event => {
            if (registeredEvents.indexOf(event) !== -1)
                return

            // Enable WM_MOUSEMOVE capture if requested
            if (event === "mousemove") {
                addon.enableMouseMove()
            }

            if ((event === "mouseup" || event === "mousedown" || event === "mousemove" || event === "mousewheel") && !createdListener) {
                // Careful: this currently "leaks" a thread every time it's called.
                // We should probably get around to fixing that.
                createdListener = addon.createMouseHook((event, x, y, cursor, timestamp, button, delta) => {
                    const payload = { x, y, cursor, timestamp }
                    if (event === "mousewheel") {
                        payload.delta = FromInt32(delta) / 120
                        payload.axis = button
                    } else if (event === "mousedown" || event === "mouseup") {
                        payload.button = button
                        const mouseData = FromInt32(delta)
                        if (mouseData) payload.button = 3 + mouseData
                    }
                    this.emit(event, payload)
                })
                if (createdListener) {
                    this.resumeMouseEvents()
                }
            } else {
                return
            }

            registeredEvents.push(event)
        })

        this.on("removeListener", event => {
            if (this.listenerCount(event) > 0)
                return

            registeredEvents = registeredEvents.filter(x => x !== event)
            if (event === "mousemove") {
                addon.disableMouseMove()
            }
        })
    }

    getPaused() {
        return paused
    }

    pauseMouseEvents() {
        if (paused) return false
        paused = true
        return addon.pauseMouseEvents()
    }

    resumeMouseEvents() {
        if (!paused) return -1
        paused = -1
        return addon.resumeMouseEvents()
    }
}

function FromInt32(x) {
    var uint32 = x - Math.floor(x / 4294967296) * 4294967296
    if (uint32 >= 2147483648) {
        return (uint32 - 4294967296) / 65536
    } else {
        return uint32 / 65536
    }
}