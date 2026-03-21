import { shallowEqual } from "react-redux"
import Animator from "../Animator"
import Subtitle,
{
    INITIAL_ALPHA,
    INITIAL_SCALE
} from "./Subtitle"
import Word from "./Word"

const SPACE_BETWEEN_WORDS = 0.18
const PADDING_X = 0.3
const PADDING_Y = 0.2
const LINE_HEIGHT = 0.07
const ADJACENT_WORD_THRESHOLD = 500
const LINE_INTRO = 200
const LINE_OUTRO = 200
const LINE_INTRO_OFFSET = 100
const LINE_OUTRO_OFFSET = 100

export default class SubtitleAnimator extends Animator {
    constructor(container, font) {
        super()

        this.rendererDims = null
        this.backgroundColor = null
        this.textColor = null
        this.width = null
        this.shadowAlpha = null
        this.position = null

        this.font = font
        this.container = container
    }

    update(timestamp) {
        if (this.anims.length === 0) return

        const frame = this.computeFrame(timestamp)
        frame.anims.forEach(anim => {
            const container = this.container.children.find(({ uid }) => uid === anim.uid)
            container.zIndex = anim.zIndex
            container.alpha = anim.alpha
            container.scale.set(anim.scale)
            container.visible = anim.visible
            anim.words.forEach(word => {
                const wordContainer = container.children[0].children.find(({ uid }) => uid === word.uid)
                wordContainer.children[0].alpha = word.alpha
                wordContainer.children[0].scale.set(word.scale)
            })
        })

        this.container.children
            .filter(({ uid }) => !frame.anims.some(anim => anim.uid === uid))
            .forEach(container => {
                container.visible = false
                container.zIndex = 2
                container.alpha = INITIAL_ALPHA
                container.scale.set(INITIAL_SCALE)
            })
    }

    setState({ backgroundColor, textColor, width, shadowAlpha, position, configs, rendererDims }) {
        let isPositionDirty = false
        let isConfigureDirty = false

        if (backgroundColor !== undefined && this.backgroundColor !== backgroundColor) {
            this.backgroundColor = backgroundColor
            isConfigureDirty = true
        }

        if (textColor !== undefined && this.textColor !== textColor) {
            this.textColor = textColor
            isConfigureDirty = true
        }

        if (configs !== undefined && !shallowEqual(this.configs, configs)) {
            this.configs = configs
            isConfigureDirty = true
        }

        if (width !== undefined && this.width !== width) {
            this.width = width
            isConfigureDirty = true
        }

        if (shadowAlpha !== undefined && this.shadowAlpha !== shadowAlpha) {
            this.shadowAlpha = shadowAlpha
            isConfigureDirty = true
        }

        if (position !== undefined && this.position !== position) {
            this.position = position
            isPositionDirty = true
        }

        if (rendererDims !== undefined && !shallowEqual(this.rendererDims, rendererDims)) {
            this.rendererDims = rendererDims
            isConfigureDirty = true
            isPositionDirty = true
        }

        if (isConfigureDirty) this.configure()
        if (isPositionDirty) this.configurePosition()
    }

    configure() {
        if (!this.configs || !this.rendererDims || this.backgroundColor === null || this.textColor === null || this.width === null || this.shadowAlpha === null || this.position === null) return

        // All sizing should be based on word (or line) height. 
        // That's the measure that stays the same between aspect ratios
        const maxWidth = this.rendererDims.x * this.width
        const lineHeight = this.rendererDims.y * LINE_HEIGHT
        const spaceBetweenWords = lineHeight * SPACE_BETWEEN_WORDS
        const paddingX = lineHeight * PADDING_X
        const paddingY = lineHeight * PADDING_Y

        this.container.removeChildren()
            .forEach(child => child.destroy({ children: true, texture: true, textureSource: true, context: true }))

        if (this.rendererDims.x > 0) {
            // create sprites for each word
            const wordSprites = this.configs.map(config => new Word(
                config.start, config.end, config.text, this.font, this.textColor, lineHeight))

            const wordSequences = []

            // assemble subtitle lines
            let currentWidth = paddingX * 2
            wordSprites.forEach((word, i) => {
                const prev = wordSprites[i - 1]
                if (currentWidth + word.container.width > maxWidth || !prev || (word.start - prev.end > ADJACENT_WORD_THRESHOLD)) {
                    wordSequences.push([])
                    currentWidth = 0
                }
                currentWidth += word.container.width + spaceBetweenWords
                wordSequences[wordSequences.length - 1].push(word)
            })

            // put together a container with sprites for each line
            this.anims = wordSequences.map(wordSequence => {
                const start = wordSequence[0].start - LINE_INTRO_OFFSET
                const end = wordSequence[wordSequence.length - 1].end + LINE_OUTRO_OFFSET
                const intro = Math.min(LINE_INTRO, (end - start) * 0.5)
                const outro = Math.min(LINE_OUTRO, (end - start) * 0.5)
                return new Subtitle(start, end, intro, outro, wordSequence, paddingX, paddingY,
                    spaceBetweenWords, this.backgroundColor, this.shadowAlpha, this.container, this.rendererDims)
            })
        }
    }

    computeFrame(timestamp) {
        const frames = this.anims
            .filter(anim => timestamp >= anim.start && timestamp <= anim.end)
            .map(anim => anim.computeFrame(timestamp))
        return { anims: frames }
    }

    configurePosition() {
        if (this.position === null || this.rendererDims === null) return

        this.container.position.set(this.rendererDims.x * this.position.x, this.rendererDims.y * this.position.y)
    }
}