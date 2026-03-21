/**
 * Sentry helpers - Tauri compatible.
 * The @sentry/electron package is not compatible with Tauri.
 * To re-enable error tracking, install @sentry/browser and configure here.
 */

export const initSentry = async () => {
    // No-op for Tauri build
}

export const captureException = (error) => {
    console.error('[Error]', error)
}

export const getWebWorkerIntegration = () => null
