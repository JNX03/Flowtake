import PropTypes from 'prop-types'
import { useState } from 'react'
import { ChevronDownIcon } from '@heroicons/react/20/solid'
import Toggle from '../../properties/Toggle'

export default function PreFeatureCard({ icon: Icon, title, description, enabled, onToggle, children, defaultOpen }) {
    const [isOpen, setIsOpen] = useState(defaultOpen ?? false)

    return (
        <section className="rounded-lg border border-base-content/10 bg-base-content/[0.02] overflow-hidden">
            <header className="flex items-center gap-3 px-3 py-2.5">
                <div className={`size-8 flex items-center justify-center rounded-md ${enabled ? 'bg-primary/15 text-primary' : 'bg-base-content/5 text-base-content/40'}`}>
                    <Icon className="size-4" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold">{title}</h4>
                        <span className="px-1 py-0.5 rounded bg-amber-500/15 text-amber-400 text-[8px] font-bold uppercase tracking-wider">Built-in</span>
                    </div>
                    <p className="text-[11px] text-base-content/50 leading-snug">{description}</p>
                </div>
                <Toggle value={enabled} onChange={(e) => onToggle(e.target.checked)} />
                <button
                    type="button"
                    onClick={() => setIsOpen(o => !o)}
                    className="p-1 rounded text-base-content/40 hover:text-base-content/80 hover:bg-base-content/5 transition-colors"
                    aria-label={isOpen ? 'Collapse settings' : 'Expand settings'}>
                    <ChevronDownIcon className={`size-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
            </header>
            {isOpen && (
                <div className={`px-3 pb-3 pt-1 border-t border-base-content/5 ${enabled ? '' : 'opacity-40 pointer-events-none'}`}>
                    {children}
                </div>
            )}
        </section>
    )
}

PreFeatureCard.propTypes = {
    icon: PropTypes.elementType.isRequired,
    title: PropTypes.string.isRequired,
    description: PropTypes.string.isRequired,
    enabled: PropTypes.bool.isRequired,
    onToggle: PropTypes.func.isRequired,
    children: PropTypes.node,
    defaultOpen: PropTypes.bool,
}
