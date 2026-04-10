import {
    Container,
    Text
} from "pixi.js"
import { interpolate } from "../../sceneHelpers"
import Animation from "../Animation"

const wordBaseAlpha = 0.5
const wordMaxAlpha = 1
const wordScaleFactor = 0.95
const wordIntroDuration = 200

export default class Word extends Animation {
    constructor(start, end, text, font, textColor, lineHeight) {
        super(start, end)

        this.intro = this.getAdjustedIntro(wordIntroDuration)
        this.container = new Container()
        this.sprite = new Text({ text, style: { fill: textColor, fontSize: 40, fontFamily: font } })
        this.sprite.scale.set(lineHeight / this.sprite.height)
        this.sprite.anchor.set(0.5)
        this.sprite.position.set(this.sprite.width * 0.5, this.sprite.height * 0.5)
        this.container.addChild(this.sprite)
    }

    onBeforeIntro() {
        return {
            alpha: wordBaseAlpha,
            scale: this.wordMaxScale * wordScaleFactor,
            uid: this.container.uid
        }
    }

    onAfterOutro() {
        return {
            alpha: wordMaxAlpha,
            scale: this.wordMaxScale,
            uid: this.container.uid
        }
    }

    onIntro(interpolator) {
        this.sprite.alpha = interpolate(wordBaseAlpha, wordMaxAlpha, interpolator)
        this.sprite.scale.set(interpolate(this.wordMaxScale * wordScaleFactor, this.wordMaxScale, interpolator))
        return {
            alpha: interpolate(wordBaseAlpha, wordMaxAlpha, interpolator),
            scale: interpolate(this.wordMaxScale * wordScaleFactor, this.wordMaxScale, interpolator),
            uid: this.container.uid
        }
    }

    onBetweenIntroAndOutro() {
        this.sprite.alpha = wordMaxAlpha
        this.sprite.scale.set(this.wordMaxScale)
        return {
            alpha: wordMaxAlpha,
            scale: this.wordMaxScale,
            uid: this.container.uid
        }
    }
}