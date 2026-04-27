const is = (a, b) => (
    a === b
        ? a !== 0 || b !== 0 || 1 / a === 1 / b
        : Number.isNaN(a) && Number.isNaN(b)
)

export default function shallowEqual(a, b) {
    if (is(a, b)) return true
    if (typeof a !== "object" || a === null || typeof b !== "object" || b === null) return false

    const keysA = Object.keys(a)
    const keysB = Object.keys(b)

    if (keysA.length !== keysB.length) return false

    for (const key of keysA) {
        if (!Object.prototype.hasOwnProperty.call(b, key) || !is(a[key], b[key])) return false
    }

    return true
}
