export default class Animation {
    constructor(start = 0, end = 0) {
        this.start = start
        this.end = end
        this.intro = 0
        this.outro = 0
    }

    isBeforeIntro(timestamp) {
        return timestamp < this.start
    }

    isAfterOutro(timestamp) {
        return timestamp > this.end
    }

    isIntro(timestamp) {
        return timestamp >= this.start && timestamp < this.start + this.intro
    }

    isOutro(timestamp) {
        return timestamp > this.end - this.outro && timestamp <= this.end
    }

    isBetweenIntroAndOutro(timestamp) {
        return timestamp >= this.start + this.intro && timestamp <= this.end - this.outro
    }

    interpolatorIntro(timestamp) {
        return (timestamp - this.start) / this.intro
    }

    interpolatorOutro(timestamp) {
        return (timestamp - (this.end - this.outro)) / this.outro
    }

    computeFrame(timestamp, prevFrame) {
        this.onBeforeApply(timestamp, prevFrame)
        if (this.isBeforeIntro(timestamp)) return this.onBeforeIntro(timestamp)
        if (this.isAfterOutro(timestamp)) return this.onAfterOutro(timestamp)
        if (this.isIntro(timestamp)) return this.onIntro(this.interpolatorIntro(timestamp), timestamp)
        if (this.isBetweenIntroAndOutro(timestamp)) return this.onBetweenIntroAndOutro(timestamp)
        if (this.isOutro(timestamp)) return this.onOutro(this.interpolatorOutro(timestamp), timestamp)
        this.onAfterApply(timestamp)
    }

    onBeforeIntro() { }

    onAfterOutro() { }

    onIntro() { }

    onOutro() { }

    onBetweenIntroAndOutro() { }

    onBeforeApply() { }

    onAfterApply() { }

    destroy() { }

    getAdjustedIntro(intro) {
        return Math.min((this.end - this.start) * .5, intro)
    }

    getAdjustedOutro(outro) {
        return Math.min((this.end - this.start) * .5, outro)
    }
}
