import { is } from "@electron-toolkit/utils"
import * as Sentry from "@sentry/electron/main"
import { app } from 'electron'
import Store from 'electron-store'
import { bgCyan, bold, cyanBright, gray, green, red, yellow } from "yoctocolors-cjs"
import { api, getMachineId } from "../helpers"

export default class License {
    constructor() {
        this.store = new Store()

        this.isSentryEnabled = !is.dev && this.store.get("isIssueReportingEnabled")
        this.current = {}

        this.promise = null

        this.check()
    }

    async check(key = this.store.get("licenseKey")) {
        await this.promise
        this.promise = this.checkServer(key)
        return this.promise
    }

    async checkServer(key = null) {
        this.log(`${yellow("checking")} ${gray(key)}`)

        // test with curl -d '{"key": "abcd-efgh-ijkl-mnop", "machine": "my-machine", "version": "my-version"}' -H "Content-Type: application/json" localhost:4000/api/licenses/activate

        if (key) {
            try {
                this.current = await api('licenses/activate', { key, machine: await getMachineId(), version: app.getVersion() })

                if (this.current?.id !== null && this.current?.email) {
                    this.store.set("licenseKey", key)
                    if (this.isSentryEnabled) Sentry.setUser({ id: this.current.id, email: this.current.email })
                }
            } catch (e) {
                console.error('Error checking license:', e)
                this.current = { isValid: false, message: "no_network", isReceivingUpdates: true, id: null, email: null }
            }
        } else
            this.current = { isValid: false, message: "no_license", isReceivingUpdates: true, id: null, email: null }

        this.log(`${this.current.isValid ? green("valid") : red("invalid")} ${gray(key)}`, this.current)

        return this.current
    }

    log(text) {
        console.log(bold(`${cyanBright(bgCyan("[License]"))} ${text}`))
    }
}
