import { ChevronDownIcon, ChevronRightIcon } from "@heroicons/react/16/solid"
import PropTypes from "prop-types"
import { useCallback, useState } from "react"

export default function AssetCategory({ name, icon, children, defaultOpen = true, count = 0, onAction, actionIcon, actionTip }) {

    const [isOpen, setIsOpen] = useState(defaultOpen)

    const toggle = useCallback(() => setIsOpen(prev => !prev), [])

    return (
        <div className="flex flex-col">
            <button
                onClick={toggle}
                className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-semibold uppercase tracking-wider
                    opacity-60 hover:opacity-100 transition-opacity w-full text-left"
            >
                {isOpen
                    ? <ChevronDownIcon className="size-3 shrink-0" />
                    : <ChevronRightIcon className="size-3 shrink-0" />}
                {icon && <span className="shrink-0">{icon}</span>}
                <span className="flex-1">{name}</span>
                {count > 0 && <span className="opacity-50 font-normal">{count}</span>}
                {onAction && (
                    <span
                        onClick={e => { e.stopPropagation(); onAction() }}
                        className="tooltip tooltip-left opacity-50 hover:opacity-100"
                        data-tip={actionTip}
                    >
                        {actionIcon}
                    </span>
                )}
            </button>
            {isOpen && (
                <div className="flex flex-col gap-0.5 pl-1">
                    {children}
                </div>
            )}
        </div>
    )
}

AssetCategory.propTypes = {
    name: PropTypes.string.isRequired,
    icon: PropTypes.node,
    children: PropTypes.node,
    defaultOpen: PropTypes.bool,
    count: PropTypes.number,
    onAction: PropTypes.func,
    actionIcon: PropTypes.node,
    actionTip: PropTypes.string,
}
