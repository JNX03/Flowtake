/**
 * Sentry helpers stub for Tauri build.
 * @sentry/electron is not compatible with Tauri.
 * Replace with @sentry/browser if Sentry integration is needed.
 */

export const initSentry = async () => {
    // No-op for Tauri build
    // To re-enable, install @sentry/browser and configure here
}

export const captureException = (error) => {
    console.error('[Sentry stub]', error)
}

export const getWebWorkerIntegration = () => null
