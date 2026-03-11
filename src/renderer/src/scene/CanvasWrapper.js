export default class CanvasWrapper {
    constructor(dims) {
        this.content = null
        this.dims = dims
        this.canvas = new OffscreenCanvas(this.dims.x, this.dims.y)
        this.canvas.context = this.canvas.getContext('2d')

        this.canvas.width = dims.x
        this.canvas.height = dims.y
    }

    drawContent() {
        this.canvas.context.drawImage(this.content, 0, 0, this.canvas.width, this.canvas.height)
        this.content.close?.()
        this.content = null
    }
}