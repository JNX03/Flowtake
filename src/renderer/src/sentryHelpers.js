import {
    captureException as captureExceptionSentry,
    consoleLoggingIntegration,
    init,
    replayIntegration,
    webWorkerIntegration
} from '@sentry/electron/renderer'

let webWorkerIntegrationInstance = null

export const initSentry = async () => {
    if (await window.electron.ipcRenderer.invoke("get-is-sentry-enabled")) {
        webWorkerIntegrationInstance = webWorkerIntegration({ worker: [] })
        init(
            {
                integrations: [
                    replayIntegration(),
                    consoleLoggingIntegration({ levels: ["log", "error", "warn"] }),
                    webWorkerIntegrationInstance
                ],
                replaysSessionSampleRate: 0.1,
                replaysOnErrorSampleRate: 1.0,
                _experiments: { enableLogs: true },
            }
        )
    }
}

export const captureException = error => captureExceptionSentry(error)

export const getWebWorkerIntegration = () => webWorkerIntegrationInstance