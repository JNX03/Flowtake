import { Cog6ToothIcon } from "@heroicons/react/16/solid"
import { ExclamationCircleIcon } from "@heroicons/react/24/outline"
import PropTypes from "prop-types"
import Toast from "../../../../components/toasts/Toast"
import { buildGitHubIssueUrl } from "@shared/errorReporting"

export default function CaptureErrorToast({ id, dismiss }) {
    return (
        <Toast
            id={id}
            autoDismiss={false}
            dismiss={dismiss}
            type="alert-error"
            icon={<ExclamationCircleIcon className="size-6" />}
            actions={[{ label: "Report", url: buildGitHubIssueUrl("Screen capture failed") }]}>
            <span>There was a problem starting screen recording. Check Screen Recording permission and try again. If it keeps failing,
                choose another encoder in settings <Cog6ToothIcon className="inline-block size-4" />.</span>
        </Toast>
    )
}

CaptureErrorToast.propTypes = {
    id: PropTypes.string.isRequired,
    dismiss: PropTypes.func.isRequired
}
