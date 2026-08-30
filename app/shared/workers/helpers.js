// Message type constants
export const IPC_CALL = "IPC_CALL"
export const REDUX_DISPATCH = "REDUX_DISPATCH"
export const LOG = "LOG"
export const INIT_RENDER = "INIT_RENDER"
export const START_RENDER = "START_RENDER"
export const CANCEL_RENDER = "CANCEL_RENDER"
export const RENDER_COMPLETE = "RENDER_COMPLETE"
export const RENDER_ERROR = "RENDER_ERROR"
export const SEGMENT_FRAME = "SEGMENT_FRAME"

export const INIT_PREVIEW = "INIT_PREVIEW"
export const TIME = "TIME"
export const UPDATE = "UPDATE"
export const CREATE_CURSORS = "CREATE_CURSORS"
export const LOAD_IMAGE = "LOAD_IMAGE"
export const FRAME = "FRAME"
export const IS_PLAYING = "IS_PLAYING"
export const INIT_EXTRA_VIDEO = "INIT_EXTRA_VIDEO"
export const SET_EXTRA_VISIBILITY = "SET_EXTRA_VISIBILITY"
export const SNAPSHOT = "SNAPSHOT"

export const post = (recipient, type, payload = null, id = crypto.randomUUID(), expectsResponse = false,
    isResponse = false, transferList = [], error = null) => {
    // log(true, type, payload, isResponse)
    recipient.postMessage({ type, payload, id, expectsResponse, isResponse, error }, transferList)
}

export const postAsync = (recipient, type, payload, id = crypto.randomUUID(), transferList = []) =>
    new Promise((resolve, reject) => {
        const messageHandler = (event) => {
            const { id: responseId, isResponse, payload, error } = event.data

            if (isResponse && responseId === id) {
                recipient.removeEventListener('message', messageHandler)
                if (error === null)
                    resolve(payload)
                else {
                    const e = new Error(error.message)
                    e.name = error.name
                    e.stack = error.stack
                    e.isCaptured = true
                    reject(e)
                }
            }
        }

        recipient.addEventListener('message', messageHandler)
        post(recipient, type, payload, id, true, false, transferList)
    })

export const postIpc = (channel, data) => postAsync(self, IPC_CALL, { channel, data })

export const postDispatch = action => post(self, REDUX_DISPATCH, action)

export const log = (isPost, type, payload = null, isResponse = false) => {
    const isWorker = typeof window === "undefined"
    const left = isWorker ? "⚫" : "🔵"
    const right = isWorker ? "🟢" : "⚫"
    const direction = isPost === isWorker ? "⬅️" : "➡️"
    const prefix = `${left}${direction}${right}`
    const suffix = isResponse ? " ↩️" : ""
    console.debug(`[${prefix} ${type}${suffix}]`, payload)
}

// Helper to make arguments cloneable for postMessage
const makeCloneable = (arg) => {
    try {
        // Test if the argument is cloneable by attempting to structure clone it
        structuredClone(arg)
        return arg
    } catch {
        // If not cloneable, return typeof
        return `[${typeof arg}]`
    }
}

// Worker console that forwards messages to main thread
export const workerConsole = {
    log: (...args) => {
        post(self, LOG, { level: 'log', args: args.map(makeCloneable) })
    },
    debug: (...args) => {
        post(self, LOG, { level: 'debug', args: args.map(makeCloneable) })
    },
    info: (...args) => {
        post(self, LOG, { level: 'info', args: args.map(makeCloneable) })
    },
    warn: (...args) => {
        post(self, LOG, { level: 'warn', args: args.map(makeCloneable) })
    },
    error: (...args) => {
        post(self, LOG, { level: 'error', args: args.map(makeCloneable) })
    },
    trace: (...args) => {
        post(self, LOG, { level: 'trace', args: args.map(makeCloneable) })
    },
    table: (...args) => {
        post(self, LOG, { level: 'table', args: args.map(makeCloneable) })
    },
    group: (...args) => {
        post(self, LOG, { level: 'group', args: args.map(makeCloneable) })
    },
    groupCollapsed: (...args) => {
        post(self, LOG, { level: 'groupCollapsed', args: args.map(makeCloneable) })
    },
    groupEnd: (...args) => {
        post(self, LOG, { level: 'groupEnd', args: args.map(makeCloneable) })
    }
}
