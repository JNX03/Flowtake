export function createPixiAppOptions(canvas = null) {
    return {
        canvas,
        background: "#000",
        autoStart: false,
        antialias: true,
        accessibilityOptions: { activateOnTab: false },
        preference: "webgl", // WebGL is currently faster in workers; benchmark again after runtime upgrades.
        useBackBuffer: true,
        manageImports: false
    }
}
