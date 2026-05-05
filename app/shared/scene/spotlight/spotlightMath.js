const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

export const DEFAULT_SPOTLIGHT_RADIUS = 160
export const DEFAULT_SPOTLIGHT_OPACITY = .55
export const DEFAULT_SPOTLIGHT_FEATHER = 80

export const normalizeSpotlightConfig = ({
    radius = DEFAULT_SPOTLIGHT_RADIUS,
    opacity = DEFAULT_SPOTLIGHT_OPACITY,
    feather = DEFAULT_SPOTLIGHT_FEATHER
} = {}) => ({
    radius: clamp(Number.isFinite(radius) ? radius : DEFAULT_SPOTLIGHT_RADIUS, 1, 2000),
    opacity: clamp(Number.isFinite(opacity) ? opacity : DEFAULT_SPOTLIGHT_OPACITY, 0, .95),
    feather: clamp(Number.isFinite(feather) ? feather : DEFAULT_SPOTLIGHT_FEATHER, 0, 1000)
})

export const getSpotlightFeatherBands = (radius, feather, opacity) => {
    const config = normalizeSpotlightConfig({ radius, feather, opacity })
    if (config.feather <= 0 || config.opacity <= 0) return []

    const steps = Math.min(10, Math.max(4, Math.ceil(config.feather / 18)))

    return Array.from({ length: steps }, (_, index) => {
        const innerT = index / steps
        const outerT = (index + 1) / steps

        return {
            innerRadius: config.radius + config.feather * innerT,
            outerRadius: config.radius + config.feather * outerT,
            alpha: config.opacity * Math.pow(outerT, 1.7)
        }
    })
}
