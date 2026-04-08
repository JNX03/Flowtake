import { getCurrentWindow } from '@tauri-apps/api/window'
import PropTypes from 'prop-types'
import { useCallback } from 'react'
import icon from "../shared/assets/logo.svg"

function WindowControls() {
    const minimize = useCallback(async () => {
        try { await getCurrentWindow().minimize() } catch (e) { console.warn('minimize failed', e) }
    }, [])
    const toggleMaximize = useCallback(async () => {
        try { await getCurrentWindow().toggleMaximize() } catch (e) { console.warn('toggleMaximize failed', e) }
    }, [])
    const close = useCallback(async () => {
        try { await getCurrentWindow().close() } catch (e) { console.warn('close failed', e) }
    }, [])

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

export default function TitleBar({ children, overlayButtons, title, subtitle, hideControls }) {
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
                <div className="flex items-center gap-1">
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
    hideControls: PropTypes.bool
}
