import { DropShadowFilter } from "pixi-filters/drop-shadow"
import {
    Container,
    Graphics,
    Sprite,
    Texture
} from "pixi.js"
import { interpolate } from "../../helpers"
import Animation from "../Animation"

const BACKGROUND_ALPHA = 0.8
const WORD_HEIGHT_FACTOR = 0.0015
export const INITIAL_SCALE = .9
export const INITIAL_ALPHA = 0
const TARGET_SCALE = 1
const TARGET_ALPHA = 1

export default class Subtitle extends Animation {
    constructor(start, end, intro, outro, wordSequence, paddingX, paddingY, spaceBetweenWords, backgroundColor,
        shadowAlpha, container, rendererDims) {
        super(start, end)

        this.intro = this.getAdjustedIntro(intro)
        this.outro = this.getAdjustedOutro(outro)

        const lineContainerInner = new Container()
        const background = new Sprite(Texture.WHITE)
        lineContainerInner.addChild(background)

        let xOffset = paddingX
        wordSequence.forEach(word => {
            lineContainerInner.addChild(word.container)
            word.container.position.set(xOffset, paddingY)
            xOffset += word.container.width + spaceBetweenWords
            word.wordMaxScale = WORD_HEIGHT_FACTOR * rendererDims.y
        })

        background.width = lineContainerInner.width + paddingX
        background.height = lineContainerInner.height + paddingY
        background.tint = backgroundColor
        background.alpha = BACKGROUND_ALPHA

        lineContainerInner.pivot.set(lineContainerInner.width * 0.5, lineContainerInner.height * 0.5)
        lineContainerInner.mask = new Graphics()
            .roundRect(0, 0, lineContainerInner.width, lineContainerInner.height, lineContainerInner.height * 0.25)
            .fill({ color: 0x000000 })
        lineContainerInner.addChild(lineContainerInner.mask)

        this.container = new Container()
        this.container.zIndex = 2
        this.container.visible = false
        const shadow = new DropShadowFilter({
            offsetX: 0, offsetY: 0, blur: lineContainerInner.height * 0.2, quality: 10,
            alpha: shadowAlpha
        })
        shadow.padding = lineContainerInner.height * 1.2
        this.container.filters = [shadow]
        this.container.addChild(lineContainerInner)

        container.addChild(this.container)
        container.sortChildren()

        this.wordMaxScale = WORD_HEIGHT_FACTOR * rendererDims.y

        this.words = wordSequence
    }

    onIntro(interpolator, timestamp) {
        return {
            zIndex: 3,
            uid: this.container.uid,
            alpha: interpolate(INITIAL_ALPHA, TARGET_ALPHA, interpolator),
            scale: interpolate(INITIAL_SCALE, TARGET_SCALE, interpolator),
            visible: true,
            words: this.words.map(word => word.computeFrame(timestamp))
        }
    }

    onOutro(interpolator, timestamp) {
        return {
            zIndex: 2,
            uid: this.container.uid,
            alpha: interpolate(TARGET_ALPHA, INITIAL_ALPHA, interpolator),
            scale: interpolate(TARGET_SCALE, INITIAL_SCALE, interpolator),
            visible: true,
            words: this.words.map(word => word.computeFrame(timestamp))
        }
    }

    onBetweenIntroAndOutro(timestamp) {
        return {
            zIndex: 3,
            uid: this.container.uid,
            alpha: TARGET_ALPHA,
            scale: TARGET_SCALE,
            visible: true,
            words: this.words.map(word => word.computeFrame(timestamp))
        }
    }
}