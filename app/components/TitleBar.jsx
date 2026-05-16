import PropTypes from 'prop-types'
import { useCallback } from 'react'
import { isTauri } from '@shared/tauriBridge'
import icon from "../shared/assets/logo.svg"

const callWindow = async (method) => {
    if (!isTauri) return
    try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window')
        await getCurrentWindow()[method]()
    } catch (e) { console.warn(`${method} failed`, e) }
}

function WindowControls({ variant = "default" }) {
    const minimize = useCallback(() => callWindow('minimize'), [])
    const toggleMaximize = useCallback(() => callWindow('toggleMaximize'), [])
    const close = useCallback(() => callWindow('close'), [])

    if (variant === "traffic") {
        return (
            <div className="flex items-center h-8 gap-2 px-3 flex-none">
                <button
                    type="button"
                    onClick={close}
                    aria-label="Close window"
                    title="Close"
                    className="size-3 rounded-full bg-[#ff5f57] border border-black/10 shadow-[inset_0_-1px_0_rgba(0,0,0,0.12)]"
                />
                <button
                    type="button"
                    onClick={minimize}
                    aria-label="Minimize window"
                    title="Minimize"
                    className="size-3 rounded-full bg-[#ffbd2e] border border-black/10 shadow-[inset_0_-1px_0_rgba(0,0,0,0.12)]"
                />
                <button
                    type="button"
                    onClick={toggleMaximize}
                    aria-label="Maximize window"
                    title="Maximize"
                    className="size-3 rounded-full bg-[#28c840] border border-black/10 shadow-[inset_0_-1px_0_rgba(0,0,0,0.12)]"
                />
            </div>
        )
    }

    return (
        <div className="flex items-center h-8 flex-none">
            <button onClick={minimize}
                className="w-11 h-8 flex items-center justify-center hover:bg-base-content/10 transition-colors">
                <svg width="10" height="1" viewBox="0 0 10 1" className="fill-current">
                    <rect width="10" height="1" />
                </svg>
            </button>
            <button onClick={toggleMaximize}
                className="w-11 h-8 flex items-center justify-center hover:bg-base-content/10 transition-colors">
                <svg width="10" height="10" viewBox="0 0 10 10" className="stroke-current fill-none" strokeWidth="1">
                    <rect x="0.5" y="0.5" width="9" height="9" />
                </svg>
            </button>
            <button onClick={close}
                className="w-11 h-8 flex items-center justify-center hover:bg-red-500/80 hover:text-white transition-colors">
                <svg width="10" height="10" viewBox="0 0 10 10" className="stroke-current" strokeWidth="1.2">
                    <line x1="0" y1="0" x2="10" y2="10" />
                    <line x1="10" y1="0" x2="0" y2="10" />
                </svg>
            </button>
        </div>
    )
}

WindowControls.propTypes = {
    variant: PropTypes.oneOf(["default", "traffic"])
}

export default function TitleBar({ children, overlayButtons: _overlayButtons, title, subtitle, hideControls, variant = "default" }) {
    if (variant === "studio") {
        const displayTitle = subtitle || title || "Flowtake"

        return (
            <div className="fixed w-full top-0 z-10 h-8 flowtake-titlebar bg-base-100/95 text-base-content flex items-center">
                {!hideControls ? <WindowControls variant="traffic" /> : <div className="w-24 flex-none" />}
                <div className="flex-1 min-w-0 h-full flex items-center justify-center px-3" data-tauri-drag-region>
                    <h1 className="font-brand text-sm font-semibold max-w-full truncate">
                        <span>{displayTitle}</span>
                        <span className="font-normal text-base-content/40 ml-1">.flowtake</span>
                    </h1>
                </div>
                <div className="flex items-center gap-0.5 pr-2 relative z-10">
                    {children}
                </div>
            </div>
        )
    }

    return (
        <>
            <div className="fixed w-full top-0 z-10 bg-base-300 flex gap-2 h-8">
                <div className="flex-1 min-w-0 p-1 pr-0 flex select-none" data-tauri-drag-region>
                    <div className="avatar mr-2">
                        <div className="w-5 h-5">
                            <img src={icon} />
                        </div>
                    </div>
                    <h1 className="text-ellipsis text-nowrap overflow-hidden flex-1 flex items-center">
                        <span className="font-brand font-semibold text-sm text-ellipsis text-nowrap overflow-hidden flex-none">
                            {title || "Flowtake"}
                        </span>
                        {subtitle && (
                            <span className="font-brand font-normal text-sm ml-3 flex-1 min-w-0 text-ellipsis text-nowrap overflow-hidden">
                                {subtitle}
                            </span>
                        )}
                    </h1>
                </div>
                <div className="flex items-center gap-0.5 pr-1">
                    {children}
                </div>
                {!hideControls && <WindowControls />}
            </div>
        </>
    )
}

TitleBar.propTypes = {
    children: PropTypes.node,
    overlayButtons: PropTypes.oneOf([1, 2, 3]),
    title: PropTypes.string,
    subtitle: PropTypes.string,
    hideControls: PropTypes.bool,
    variant: PropTypes.oneOf(["default", "studio"])
}
