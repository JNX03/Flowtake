import { useEffect, useState } from "react"
import { LIGHT_THEMES, DARK_THEMES, applyTheme, broadcastTheme } from "@shared/themes"
import { ThemeCard } from "../settings/AppearanceSettings"

export default function AppearanceStep() {
    const [activeTheme, setActiveTheme] = useState("flowtake-dark")

    useEffect(() => {
        window.electron.ipcRenderer
            .invoke("store-get", "appearance-theme")
            .then((saved) => {
                if (saved) setActiveTheme(saved)
            })
            .catch(() => {})
    }, [])

    const selectTheme = async (themeId) => {
        setActiveTheme(themeId)
        applyTheme(themeId)
        broadcastTheme(themeId)
        await window.electron.ipcRenderer.invoke("store-set", "appearance-theme", themeId)
    }

    return (
        <div className="flex flex-col gap-4 max-w-lg mx-auto">
            <div>
                <h3 className="text-lg font-semibold">Appearance</h3>
                <p className="text-sm text-base-content/60 mt-1">
                    Pick a color theme for the app.
                </p>
            </div>

            <div>
                <p className="text-xs font-medium text-base-content/50 uppercase tracking-wider mb-2">Dark</p>
                <div className="grid grid-cols-3 gap-2">
                    {DARK_THEMES.map((theme) => (
                        <ThemeCard
                            key={theme.id}
                            theme={theme}
                            active={activeTheme === theme.id}
                            onClick={() => selectTheme(theme.id)}
                        />
                    ))}
                </div>
            </div>

            <div>
                <p className="text-xs font-medium text-base-content/50 uppercase tracking-wider mb-2">Light</p>
                <div className="grid grid-cols-3 gap-2">
                    {LIGHT_THEMES.map((theme) => (
                        <ThemeCard
                            key={theme.id}
                            theme={theme}
                            active={activeTheme === theme.id}
                            onClick={() => selectTheme(theme.id)}
                        />
                    ))}
                </div>
            </div>
        </div>
    )
}
