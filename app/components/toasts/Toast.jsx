import { XMarkIcon } from "@heroicons/react/16/solid"
import PropTypes from "prop-types"
import {
    useCallback,
    useEffect
} from "react"

export default function Toast({ icon, actions, type, children, autoDismiss, dismiss, id }) {

    const onDismiss = useCallback(() => dismiss(id), [dismiss, id])

    useEffect(() => {
        if (autoDismiss) {
            const timeoutId = setTimeout(onDismiss, 5000)
            return () => { clearTimeout(timeoutId) }
        }
    }, [autoDismiss, onDismiss])

    const actionButtons = () => {
        return actions?.map(({ label, callback, url }, i) => url
            ? <a key={i} className="btn btn-sm btn-ghost" href={url} target="_blank" rel="noreferrer">{label}</a>
            : <button key={i} className="btn btn-sm btn-ghost" onClick={callback}>{label}</button>
        )
    }

    return (<div className={`alert ${type} w-full shadow-lg`}>
        {icon}
        <span className="text-wrap">{children}</span>
        <div className="flex items-center">
            {actionButtons()}
            <button className="btn btn-sm btn-ghost ml-1" onClick={onDismiss}><XMarkIcon className="size-4" /></button>
        </div>
    </div>)
}

Toast.propTypes = {
    id: PropTypes.string.isRequired,
    icon: PropTypes.element,
    actions: PropTypes.arrayOf(PropTypes.shape({
        label: PropTypes.string.isRequired,
        callback: PropTypes.func,
        url: PropTypes.string
    })),
    type: PropTypes.string,
    children: PropTypes.node.isRequired,
    autoDismiss: PropTypes.bool,
    dismiss: PropTypes.func.isRequired
}