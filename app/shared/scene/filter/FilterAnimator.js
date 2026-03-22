import { AdjustmentFilter } from "pixi-filters/adjustment"
import { HslAdjustmentFilter } from "pixi-filters/hsl-adjustment"
import { BlurFilter } from "pixi.js"

/**
 * FilterAnimator applies color adjustment and blur filters to the screen container.
 * Reads filter config from Redux state and applies via Pixi.js filters.
 */
export default class FilterAnimator {
    constructor(screenContainer) {
        this.screenContainer = screenContainer
        this.filterConfig = null

        this.adjustmentFilter = new AdjustmentFilter({
            brightness: 1,
            contrast: 1,
            saturation: 1,
            gamma: 1,
        })

        this.hslFilter = new HslAdjustmentFilter({
            hue: 0,
            saturation: 0,
            lightness: 0,
        })

        this.blurFilter = new BlurFilter({ strength: 0 })
        this.blurFilter.enabled = false

        this.filtersApplied = false
    }

    setState({ filterConfig }) {
        if (filterConfig !== undefined) {
            this.filterConfig = filterConfig
            this.applyFilters()
        }
    }

    applyFilters() {
        if (!this.filterConfig || !this.screenContainer) return

        const { brightness, contrast, saturation, gamma, blur, hue, temperature, vignette } = this.filterConfig

        // Check if any filters are non-default
        const hasAdjustment = brightness !== 1 || contrast !== 1 || saturation !== 1 || gamma !== 1 || temperature !== 0
        const hasBlur = blur > 0
        const hasHue = hue !== 0
        const hasVignette = vignette > 0

        if (!hasAdjustment && !hasBlur && !hasHue && !hasVignette) {
            // Remove filters if all at defaults
            if (this.filtersApplied) {
                this.screenContainer.filters = this.screenContainer.filters?.filter(
                    f => f !== this.adjustmentFilter && f !== this.blurFilter && f !== this.hslFilter
                ) || []
                this.filtersApplied = false
            }
            return
        }

        // Apply adjustment filter (brightness, contrast, saturation, gamma, temperature)
        this.adjustmentFilter.brightness = brightness
        this.adjustmentFilter.contrast = contrast
        this.adjustmentFilter.saturation = saturation
        this.adjustmentFilter.gamma = gamma

        // Temperature shifts red/blue channels (warm = +red -blue, cool = -red +blue)
        this.adjustmentFilter.red = 1 + temperature * 0.3
        this.adjustmentFilter.blue = 1 - temperature * 0.3

        // Vignette darkens overall brightness slightly when applied
        if (hasVignette) {
            this.adjustmentFilter.brightness = brightness * (1 - vignette * 0.15)
            this.adjustmentFilter.gamma = gamma * (1 + vignette * 0.2)
        }

        // Apply hue rotation via HSL filter
        this.hslFilter.hue = hue
        this.hslFilter.enabled = hasHue

        // Apply blur
        this.blurFilter.strength = blur
        this.blurFilter.enabled = hasBlur

        if (!this.filtersApplied) {
            const existing = this.screenContainer.filters || []
            this.screenContainer.filters = [...existing, this.adjustmentFilter, this.hslFilter, this.blurFilter]
            this.filtersApplied = true
        }
    }

    update() {
        // Filters are static per config, no per-frame updates needed
    }
}
