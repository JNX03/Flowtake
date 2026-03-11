import { app, autoUpdater } from 'electron'

export default class Updater {
    constructor() {
        const server = 'https://nuts.getflowtake.com'
        const url = `${server}/update/${process.platform}/${app.getVersion()}`

        autoUpdater.setFeedURL({ url })
    }

    check(onUpdateDownloaded, onError) {
        autoUpdater.on('update-downloaded', () => {
            onUpdateDownloaded()
        })

        autoUpdater.on('error', message => {
            onError(message)
            console.error(message)
        })

        autoUpdater.checkForUpdates()
    }

    install() {
        autoUpdater.quitAndInstall()
    }
}
