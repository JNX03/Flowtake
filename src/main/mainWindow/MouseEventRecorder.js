// This only works with python v3.10 or lower!
// https://stackoverflow.com/questions/74715990/node-gyp-err-invalid-mode-ru-while-trying-to-load-binding-gyp


// To prevent node-gyp errors:
// - Install Python 3.x.x
// - Set PYTHON env var
// - Install pip install setuptools - worked
// - npm i
// - when building / executing / running dev server Python is NOT required

// cursor-events is based on global-mouse-events
import CursorEvents from '../../native/cursor-events/index.js'

export default class MouseEventRecorder {
    constructor() {
        this.mouseEvents = []
        this.cursorEvents = new CursorEvents()
        this.cursorEvents.pauseMouseEvents()
    }

    start() {
        this.cursorEvents.on("mouseup", event => this.addEvent(event, "mouseup"))
        this.cursorEvents.on("mousedown", event => this.addEvent(event, "mousedown"))
        this.cursorEvents.on("mousemove", event => this.addEvent(event, "mousemove"))
        this.mouseEvents = []
        this.cursorEvents.resumeMouseEvents()
    }

    stop() {
        this.cursorEvents.pauseMouseEvents()
        this.cursorEvents.removeAllListeners("mouseup")
        this.cursorEvents.removeAllListeners("mousedown")
        this.cursorEvents.removeAllListeners("mousemove")
    }

    addEvent(event, type) {
        this.mouseEvents.push({ ...event, type })
    }

    getEvents(startTimestamp) {
        return this.mouseEvents
            .map(event => ({ ...event, timestamp: event.timestamp - startTimestamp }))
            .filter(({ timestamp }) => timestamp >= 0)
            .map(click => ({ ...click, isActive: true }))
            // sort them by timestamp, just to be sure
            .sort((a, b) => a.timestamp - b.timestamp)
            // add an id
            .map((click, i) => ({ ...click, id: i }))
    }
}
