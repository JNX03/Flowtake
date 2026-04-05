import { useEffect, useState } from "react"
import { LIGHT_THEMES, DARK_THEMES, applyTheme } from "@shared/themes"
import Fieldset from "../properties/Fieldset"

export default function AppearanceSettings() {
    const [activeTheme, setActiveTheme] = useState("flowtake-dark")

    useEffect(() => {
        window.electron.ipcRenderer
            .invoke("store-get", "appearance-theme")
            .then((saved) => {
                if (saved) {
                    setActiveTheme(saved)
                    applyTheme(saved)
                }
            })
            .catch(() => {})
    }, [])

    const selectTheme = async (themeId) => {
        setActiveTheme(themeId)
        applyTheme(themeId)
        await window.electron.ipcRenderer.invoke(
            "store-set",
            "appearance-theme",
            themeId
        )
    }

    return (
        <div className="flex flex-col gap-4">
            <h4 className="font-semibold text-lg">Appearance</h4>

            <Fieldset legend="Theme" description="Choose a color theme for the app.">
                <p className="text-xs font-semibold text-base-content/50 uppercase tracking-wider mb-2 mt-1">Light</p>
                <div className="grid grid-cols-2 gap-3">
                    {LIGHT_THEMES.map((theme) => (
                        <ThemeCard
                            key={theme.id}
                            theme={theme}
                            active={activeTheme === theme.id}
                            onClick={() => selectTheme(theme.id)}
                        />
                    ))}
                </div>

                <p className="text-xs font-semibold text-base-content/50 uppercase tracking-wider mb-2 mt-5">Dark</p>
                <div className="grid grid-cols-2 gap-3">
                    {DARK_THEMES.map((theme) => (
                        <ThemeCard
                            key={theme.id}
                            theme={theme}
                            active={activeTheme === theme.id}
                            onClick={() => selectTheme(theme.id)}
                        />
                    ))}
                </div>
            </Fieldset>
        </div>
    )
}

export function ThemeCard({ theme, active, onClick }) {
    const { name, colors } = theme
    return (
        <button
            onClick={onClick}
            className={`group relative flex flex-col rounded-lg border-2 overflow-hidden transition-all cursor-pointer
                ${active
                    ? "border-primary ring-1 ring-primary/30"
                    : "border-base-content/10 hover:border-base-content/25"
                }`}
        >
            {/* Mini preview */}
            <div
                className="h-16 w-full flex items-end gap-1.5 p-2"
                style={{ background: colors.bg }}
            >
                {/* Fake sidebar */}
                <div className="flex flex-col gap-1 h-full w-5 shrink-0">
                    <div
                        className="w-full h-1.5 rounded-full"
                        style={{ background: colors.primary, opacity: 0.8 }}
                    />
                    <div
                        className="w-full h-1.5 rounded-full opacity-30"
                        style={{ background: colors.primary }}
                    />
                    <div
                        className="w-full h-1.5 rounded-full opacity-20"
                        style={{ background: colors.primary }}
                    />
                </div>
                {/* Fake content area */}
                <div className="flex-1 flex flex-col gap-1 justify-end">
                    <div
                        className="w-3/4 h-1.5 rounded-full opacity-25"
                        style={{ background: colors.content || "#fff" }}
                    />
                    <div className="flex gap-1">
                        <div
                            className="h-4 w-10 rounded"
                            style={{ background: colors.primary }}
                        />
                        <div
                            className="h-4 w-6 rounded"
                            style={{ background: colors.accent }}
                        />
                    </div>
                </div>
            </div>

            {/* Label */}
            <div
                className={`px-2.5 py-1.5 text-xs font-medium text-left w-full transition-colors
                    ${active ? "text-primary" : "text-base-content/70 group-hover:text-base-content"}`}
            >
                {name}
            </div>

            {/* Active indicator */}
            {active && (
                <div className="absolute top-1.5 right-1.5 size-4 rounded-full bg-primary flex items-center justify-center">
                    <svg className="size-2.5 text-primary-content" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M2 6l3 3 5-5" />
                    </svg>
                </div>
            )}
        </button>
    )
}
