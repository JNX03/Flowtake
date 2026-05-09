// Manual, hotkey-driven zoom controller for the live compositor.
// Unlike the editor's timeline-anchored CameraZoom, this is purely event-driven.

const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3)

export default class LiveZoomController {
    constructor({
        mode = 'hold',
        targetScale = 2.0,
        easeMs = 350,
        steps = [1.0, 1.5, 2.0, 2.5],
    } = {}) {
        this.mode = mode
        this.targetScale = targetScale
        this.easeMs = easeMs
        this.steps = steps

        this.currentScale = 1
        this.fromScale = 1
        this.toScale = 1
        this.transitionStartedAt = null

        this.anchor = { x: 0, y: 0 }
        this.lockedAnchor = null

        this.toggleActive = false
        this.stepIndex = 0
    }

    setMode(mode) {
        this.mode = mode
    }

    setTargetScale(scale) {
        this.targetScale = scale
    }

    setEaseMs(ms) {
        this.easeMs = ms
    }

    updateAnchor(cursorPos) {
        if (cursorPos) {
            this.anchor = { x: cursorPos.x, y: cursorPos.y }
        }
    }

    _beginTransition(toScale, anchor) {
        this.fromScale = this.currentScale
        this.toScale = toScale
        this.transitionStartedAt = performance.now()
        if (anchor) this.lockedAnchor = { ...anchor }
    }

    onKeyDown(cursorPos) {
        if (this.mode === 'hold') {
            this._beginTransition(this.targetScale, cursorPos || this.anchor)
        } else if (this.mode === 'toggle') {
            this.toggleActive = !this.toggleActive
            this._beginTransition(
                this.toggleActive ? this.targetScale : 1,
                this.toggleActive ? cursorPos || this.anchor : this.lockedAnchor || this.anchor
            )
        } else if (this.mode === 'step') {
            this.stepIndex = Math.min(this.stepIndex + 1, this.steps.length - 1)
            this._beginTransition(
                this.steps[this.stepIndex],
                cursorPos || this.anchor
            )
        }
    }

    onKeyUp() {
        if (this.mode === 'hold') {
            this._beginTransition(1, this.lockedAnchor || this.anchor)
        }
    }

    onStepOut() {
        if (this.mode === 'step') {
            this.stepIndex = Math.max(this.stepIndex - 1, 0)
            this._beginTransition(this.steps[this.stepIndex], this.lockedAnchor || this.anchor)
        }
    }

    /// Compute current scale and anchor for the given timestamp; mutates internal state.
    sample(now = performance.now()) {
        if (this.transitionStartedAt !== null) {
            const elapsed = now - this.transitionStartedAt
            const t = Math.min(Math.max(elapsed / Math.max(this.easeMs, 1), 0), 1)
            const eased = easeOutCubic(t)
            this.currentScale = this.fromScale + (this.toScale - this.fromScale) * eased
            if (t >= 1) {
                this.currentScale = this.toScale
                this.transitionStartedAt = null
                if (this.toScale === 1) this.lockedAnchor = null
            }
        }
        return {
            scale: this.currentScale,
            anchor: this.lockedAnchor || this.anchor,
            isZoomed: this.currentScale > 1.001 || this.transitionStartedAt !== null,
        }
    }

    /// Apply the transform to a Pixi container so that `anchor` stays put under the zoom.
    applyTransform(container, viewportWidth, viewportHeight) {
        const { scale, anchor } = this.sample()
        // Map anchor (screen coords) into viewport coords [0..viewportWidth/Height]
        const ax = Math.max(0, Math.min(anchor.x, viewportWidth))
        const ay = Math.max(0, Math.min(anchor.y, viewportHeight))
        // Standard zoom-around-point: translate so anchor moves to origin, scale, translate back
        container.scale.set(scale, scale)
        container.position.set(ax - ax * scale, ay - ay * scale)
    }
}
