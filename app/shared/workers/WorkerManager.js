import modelAssetPath from "../assets/selfie_segmenter_landscape.tflite"
import crosshairCursorDarkSVG from "../assets/svgs/cursors/dark/crosshair.svg"
import defaultCursorDarkSVG from "../assets/svgs/cursors/dark/default.svg"
import ewResizeCursorDarkSVG from "../assets/svgs/cursors/dark/ewResize.svg"
import moveCursorDarkSVG from "../assets/svgs/cursors/dark/move.svg"
import neswResizeCursorDarkSVG from "../assets/svgs/cursors/dark/neswResize.svg"
import notAllowedCursorDarkSVG from "../assets/svgs/cursors/dark/notAllowed.svg"
import nsResizeCursorDarkSVG from "../assets/svgs/cursors/dark/nsResize.svg"
import nwseResizeCursorDarkSVG from "../assets/svgs/cursors/dark/nwseResize.svg"
import pointerCursorDarkSVG from "../assets/svgs/cursors/dark/pointer.svg"
import progressCursorDarkSVG from "../assets/svgs/cursors/dark/progress.svg"
import textCursorDarkSVG from "../assets/svgs/cursors/dark/text.svg"
import verticalTextCursorDarkSVG from "../assets/svgs/cursors/dark/verticalText.svg"
import waitCursorDarkSVG from "../assets/svgs/cursors/dark/wait.svg"
import crosshairCursorLightSVG from "../assets/svgs/cursors/light/crosshair.svg"
import defaultCursorLightSVG from "../assets/svgs/cursors/light/default.svg"
import ewResizeCursorLightSVG from "../assets/svgs/cursors/light/ewResize.svg"
import moveCursorLightSVG from "../assets/svgs/cursors/light/move.svg"
import neswResizeCursorLightSVG from "../assets/svgs/cursors/light/neswResize.svg"
import notAllowedCursorLightSVG from "../assets/svgs/cursors/light/notAllowed.svg"
import nsResizeCursorLightSVG from "../assets/svgs/cursors/light/nsResize.svg"
import nwseResizeCursorLightSVG from "../assets/svgs/cursors/light/nwseResize.svg"
import pointerCursorLightSVG from "../assets/svgs/cursors/light/pointer.svg"
import progressCursorLightSVG from "../assets/svgs/cursors/light/progress.svg"
import textCursorLightSVG from "../assets/svgs/cursors/light/text.svg"
import verticalTextCursorLightSVG from "../assets/svgs/cursors/light/verticalText.svg"
import waitCursorLightSVG from "../assets/svgs/cursors/light/wait.svg"
import { svgToBmp } from "../helpers"
import { captureException } from "../sentryHelpers"
import {
    CREATE_CURSORS,
    IPC_CALL,
    LOAD_IMAGE,
    LOG,
    post,
    postAsync
} from "./helpers"

export default class WorkerManager {
    constructor() {
        this.worker = null
        this.segmenter = null
    }

    post(type, payload = null, id = crypto.randomUUID(), expectsResponse = false, isResponse = false, transferList = [], error = null) {
        return post(this.worker, type, payload, id, expectsResponse, isResponse, transferList, error)
    }

    postAsync(type, payload, id = crypto.randomUUID(), transferList = []) {
        return postAsync(this.worker, type, payload, id, transferList)
    }

    async onMessage(event) {

        const { type, payload, id, expectsResponse, isResponse } = event.data

        // log(false, type, payload, isResponse)

        if (isResponse) return true

        let responsePayload = null
        let error = null
        const transferList = []
        let cleanup = null
        let isMessageHandled = false

        try {
            switch (type) {
                case IPC_CALL: {
                    responsePayload = await window.electron.ipcRenderer.invoke(payload.channel, ...payload.data)
                    isMessageHandled = true
                    break
                }
                case LOG: {
                    // Log worker messages to console
                    const logFn = console[payload.level] || console.log
                    logFn('[worker]', ...payload.args)
                    isMessageHandled = true
                    break
                }
                case CREATE_CURSORS: {
                    responsePayload = await this.createCursors(payload.stroke, payload.fill)
                    transferList.push(...Object.values(responsePayload))
                    isMessageHandled = true
                    break
                }
                case LOAD_IMAGE: {
                    responsePayload = await this.loadImage(payload)
                    if (responsePayload.bmp) transferList.push(responsePayload.bmp)
                    isMessageHandled = true
                    break
                }
            }
        } catch (e) {
            error = { name: e.name, message: e.message }
            captureException(e)
            isMessageHandled = true
        }

        if (isMessageHandled && expectsResponse) this.post(type, responsePayload, id, false, true, transferList, error)

        cleanup?.()

        return isMessageHandled
    }

    async createCursors(stroke, fill) {
        const theme = fill === "#fff" && stroke === "#000" ? "light" : "dark"

        const svgs = theme === "light"
            ? [
                { key: 'crosshair', svg: crosshairCursorLightSVG },
                { key: 'default', svg: defaultCursorLightSVG },
                { key: 'ew-resize', svg: ewResizeCursorLightSVG },
                { key: 'move', svg: moveCursorLightSVG },
                { key: 'nesw-resize', svg: neswResizeCursorLightSVG },
                { key: 'not-allowed', svg: notAllowedCursorLightSVG },
                { key: 'ns-resize', svg: nsResizeCursorLightSVG },
                { key: 'nwse-resize', svg: nwseResizeCursorLightSVG },
                { key: 'pointer', svg: pointerCursorLightSVG },
                { key: 'progress', svg: progressCursorLightSVG },
                { key: 'text', svg: textCursorLightSVG },
                { key: 'vertical-text', svg: verticalTextCursorLightSVG },
                { key: 'wait', svg: waitCursorLightSVG }
            ]
            : [
                { key: 'crosshair', svg: crosshairCursorDarkSVG },
                { key: 'default', svg: defaultCursorDarkSVG },
                { key: 'ew-resize', svg: ewResizeCursorDarkSVG },
                { key: 'move', svg: moveCursorDarkSVG },
                { key: 'nesw-resize', svg: neswResizeCursorDarkSVG },
                { key: 'not-allowed', svg: notAllowedCursorDarkSVG },
                { key: 'ns-resize', svg: nsResizeCursorDarkSVG },
                { key: 'nwse-resize', svg: nwseResizeCursorDarkSVG },
                { key: 'pointer', svg: pointerCursorDarkSVG },
                { key: 'progress', svg: progressCursorDarkSVG },
                { key: 'text', svg: textCursorDarkSVG },
                { key: 'vertical-text', svg: verticalTextCursorDarkSVG },
                { key: 'wait', svg: waitCursorDarkSVG }
            ]


        const bitmapPromises = await Promise.all(svgs.map(async ({ svg, key }) => ({
            key,
            bmp: await svgToBmp(svg)
        })))


        const bmps = bitmapPromises.reduce((acc, { key, bmp }) => {
            acc[key] = bmp
            return acc
        }, {})

        return bmps
    }

    async createSegmenter({ x, y }) {
        // TODO: once ImageSegmenter works in web workers, do segmentation there.
        // https://github.com/google-ai-edge/mediapipe/issues/5257
        // https://github.com/google-ai-edge/mediapipe/issues/5479
        const { FilesetResolver, ImageSegmenter } = await import("@mediapipe/tasks-vision")
        this.segmenter = await ImageSegmenter.createFromOptions(
            await FilesetResolver.forVisionTasks("../selfie_segmentation/wasm"),
            {
                baseOptions: { modelAssetPath, delegate: "GPU" },
                canvas: new OffscreenCanvas(x, y)
            })
    }

    async segment(input, closeInput = true) {
        const segmentation = this.segmenter.segment(input)
        if (closeInput) input.close()
        this.copyTextureToCanvas(
            segmentation.confidenceMasks[0].getAsWebGLTexture(),
            segmentation.confidenceMasks[0].canvas
        )
        const mask = await createImageBitmap(segmentation.confidenceMasks[0].canvas)
        segmentation.close()
        return mask
    }

    terminate() {
        this.worker?.terminate()
        this.worker = null
    }

    copyTextureToCanvas(texture, canvas) {
        if (!canvas.glContext) canvas.glContext = canvas.getContext('webgl2')

        const gl = canvas.glContext
        // Create read framebuffer
        const readFb = gl.createFramebuffer()
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, readFb)
        gl.framebufferTexture2D(gl.READ_FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0)

        // Bind default draw framebuffer
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null)

        // Blit entire texture to canvas
        gl.blitFramebuffer(
            0, 0, canvas.width, canvas.height,        // Source rect
            0, canvas.height, canvas.width, 0,        // Dest rect (flipped vertically)
            gl.COLOR_BUFFER_BIT, gl.NEAREST
        )

        // Clean up
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null)
        gl.deleteFramebuffer(readFb)
    }

    async loadImage(src) {
        const img = new Image()
        img.crossOrigin = "anonymous"

        try {
            await new Promise((resolve, reject) => {
                img.addEventListener("load", resolve, { once: true })
                img.addEventListener("error", reject, { once: true })
                img.src = src
            })
            return { bmp: await createImageBitmap(img), error: false }
        } catch (error) {
            console.warn('Failed to load image:', src, error)
            return { bmp: null, error }
        }
    }

    async getDimensions() {
        return null
    }
}