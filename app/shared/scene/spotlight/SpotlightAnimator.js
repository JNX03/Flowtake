import {
    Container,
    Graphics
} from "pixi.js"
import {
    DEFAULT_SPOTLIGHT_FEATHER,
    DEFAULT_SPOTLIGHT_OPACITY,
    DEFAULT_SPOTLIGHT_RADIUS,
    getSpotlightFeatherBands,
    normalizeSpotlightConfig
} from "./spotlightMath"

export default class SpotlightAnimator {
    constructor(container, cursor, screenVideoDimensions) {
        this.cursor = cursor
        this.screenVideoDimensions = screenVideoDimensions

        this.wrapper = new Container()
        this.wrapper.label = "spotlight-effect"
        this.wrapper.visible = false

        this.graphic = new Graphics()
        this.clipMask = new Graphics()

        this.wrapper.addChild(this.graphic)
        this.wrapper.mask = this.clipMask

        container.addChild(this.wrapper)
        container.addChild(this.clipMask)

        this.showSpotlight = false
        this.radius = DEFAULT_SPOTLIGHT_RADIUS
        this.opacity = DEFAULT_SPOTLIGHT_OPACITY
        this.feather = DEFAULT_SPOTLIGHT_FEATHER
        this.borderRadius = 0
        this.trim = {
            left: 0,
            right: 0,
            top: 0,
            bottom: 0
        }
    }

    update() {
        if (!this.showSpotlight || !this.cursor.visible || this.opacity <= 0) {
            this.wrapper.visible = false
            return
        }

        const rect = this.getVisibleRect()
        if (rect.width <= 0 || rect.height <= 0) {
            this.wrapper.visible = false
            return
        }

        this.drawClipMask(rect)
        this.drawSpotlight(rect)
        this.wrapper.visible = true
    }

    setState({
        showSpotlight,
        radius,
        opacity,
        feather,
        leftTrim,
        rightTrim,
        topTrim,
        bottomTrim,
        borderRadius
    }) {
        if (showSpotlight !== undefined) this.showSpotlight = showSpotlight
        if (radius !== undefined || opacity !== undefined || feather !== undefined) {
            const config = normalizeSpotlightConfig({
                radius: radius ?? this.radius,
                opacity: opacity ?? this.opacity,
                feather: feather ?? this.feather
            })
            this.radius = config.radius
            this.opacity = config.opacity
            this.feather = config.feather
        }

        if (leftTrim !== undefined) this.trim.left = leftTrim
        if (rightTrim !== undefined) this.trim.right = rightTrim
        if (topTrim !== undefined) this.trim.top = topTrim
        if (bottomTrim !== undefined) this.trim.bottom = bottomTrim
        if (borderRadius !== undefined) this.borderRadius = borderRadius
    }

    getVisibleRect() {
        return {
            x: this.trim.left,
            y: this.trim.top,
            width: Math.max(0, this.screenVideoDimensions.x - this.trim.left - this.trim.right),
            height: Math.max(0, this.screenVideoDimensions.y - this.trim.top - this.trim.bottom)
        }
    }

    drawClipMask(rect) {
        const radius = Math.min(this.borderRadius, rect.width * .5, rect.height * .5)

        this.clipMask.clear()
        this.clipMask.roundRect(rect.x, rect.y, rect.width, rect.height, radius)
        this.clipMask.fill({ color: 0x000000 })
    }

    drawSpotlight(rect) {
        const x = this.cursor.position.x
        const y = this.cursor.position.y
        const outerRadius = this.radius + this.feather
        const borderRadius = Math.min(this.borderRadius, rect.width * .5, rect.height * .5)

        this.graphic.clear()
        this.graphic.roundRect(rect.x, rect.y, rect.width, rect.height, borderRadius)
        this.graphic.fill({ color: 0x000000, alpha: this.opacity })

        this.graphic.circle(x, y, outerRadius)
        this.graphic.cut()

        getSpotlightFeatherBands(this.radius, this.feather, this.opacity).forEach(({ innerRadius, outerRadius, alpha }) => {
            this.graphic.circle(x, y, outerRadius)
            this.graphic.fill({ color: 0x000000, alpha })
            this.graphic.circle(x, y, innerRadius)
            this.graphic.cut()
        })
    }

    destroy() {
        this.wrapper.removeFromParent()
        this.clipMask.removeFromParent()
        this.wrapper.destroy({ children: true })
        this.clipMask.destroy()
    }
}
