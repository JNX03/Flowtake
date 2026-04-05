import { addToast } from "./redux/appSlice"
import { TOAST_ERROR } from "./helpers"
import { buildGitHubIssueUrl } from "./errorReporting"

export function addErrorToast(text) {
    const url = buildGitHubIssueUrl(text)
    return addToast({
        type: TOAST_ERROR,
        text,
        autoDismiss: false,
        actions: [{ label: "Report", url }]
    })
}
