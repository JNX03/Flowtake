import { AdjustmentFilter } from "pixi-filters/adjustment"
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

        const { brightness, contrast, saturation, gamma, blur } = this.filterConfig

        // Check if any filters are non-default
        const hasAdjustment = brightness !== 1 || contrast !== 1 || saturation !== 1 || gamma !== 1
        const hasBlur = blur > 0

        if (!hasAdjustment && !hasBlur) {
            // Remove filters if all at defaults
            if (this.filtersApplied) {
                this.screenContainer.filters = this.screenContainer.filters?.filter(
                    f => f !== this.adjustmentFilter && f !== this.blurFilter
                ) || []
                this.filtersApplied = false
            }
            return
        }

        // Apply adjustment filter
        this.adjustmentFilter.brightness = brightness
        this.adjustmentFilter.contrast = contrast
        this.adjustmentFilter.saturation = saturation
        this.adjustmentFilter.gamma = gamma

        // Apply blur
        this.blurFilter.strength = blur
        this.blurFilter.enabled = hasBlur

        if (!this.filtersApplied) {
            const existing = this.screenContainer.filters || []
            this.screenContainer.filters = [...existing, this.adjustmentFilter, this.blurFilter]
            this.filtersApplied = true
        }
    }

    update() {
        // Filters are static per config, no per-frame updates needed
    }
}
