import { useEffect, useState } from "react"
import Fieldset from "../properties/Fieldset"

const LIGHT_THEMES = [
    {
        id: "flowtake-light",
        name: "Flowtake Light",
        colors: { primary: "#6C5CE7", accent: "#00CEC9", bg: "#ffffff", content: "#1f2937" }
    },
    {
        id: "catppuccin-latte",
        name: "Catppuccin Latte",
        colors: { primary: "#8839ef", accent: "#40a02b", bg: "#eff1f5", content: "#4c4f69" }
    },
    {
        id: "solarized-light",
        name: "Solarized Light",
        colors: { primary: "#268bd2", accent: "#2aa198", bg: "#fdf6e3", content: "#586e75" }
    },
    {
        id: "nord-light",
        name: "Nord Light",
        colors: { primary: "#5e81ac", accent: "#a3be8c", bg: "#eceff4", content: "#2e3440" }
    },
    {
        id: "rose-pine-dawn",
        name: "Rose Pine Dawn",
        colors: { primary: "#907aa9", accent: "#56949f", bg: "#faf4ed", content: "#575279" }
    },
    {
        id: "github-light",
        name: "GitHub Light",
        colors: { primary: "#0969da", accent: "#1a7f37", bg: "#ffffff", content: "#1f2328" }
    },
    {
        id: "gruvbox-light",
        name: "Gruvbox Light",
        colors: { primary: "#d65d0e", accent: "#79740e", bg: "#fbf1c7", content: "#3c3836" }
    }
]

const DARK_THEMES = [
    {
        id: "flowtake-dark",
        name: "Flowtake Dark",
        colors: { primary: "#6C5CE7", accent: "#00CEC9", bg: "#1a1a2e", content: "#e0e0f0" }
    },
    {
        id: "tokyo-night",
        name: "Tokyo Night",
        colors: { primary: "#7aa2f7", accent: "#9ece6a", bg: "#1a1b26", content: "#c0caf5" }
    },
    {
        id: "dracula",
        name: "Dracula",
        colors: { primary: "#bd93f9", accent: "#50fa7b", bg: "#282a36", content: "#f8f8f2" }
    },
    {
        id: "nord-dark",
        name: "Nord",
        colors: { primary: "#88c0d0", accent: "#a3be8c", bg: "#2e3440", content: "#eceff4" }
    },
    {
        id: "catppuccin-mocha",
        name: "Catppuccin Mocha",
        colors: { primary: "#cba6f7", accent: "#a6e3a1", bg: "#1e1e2e", content: "#cdd6f4" }
    },
    {
        id: "gruvbox-dark",
        name: "Gruvbox Dark",
        colors: { primary: "#fabd2f", accent: "#b8bb26", bg: "#282828", content: "#ebdbb2" }
    },
    {
        id: "solarized-dark",
        name: "Solarized Dark",
        colors: { primary: "#268bd2", accent: "#2aa198", bg: "#002b36", content: "#93a1a1" }
    },
    {
        id: "rose-pine",
        name: "Rose Pine",
        colors: { primary: "#c4a7e7", accent: "#9ccfd8", bg: "#191724", content: "#e0def4" }
    },
    {
        id: "synthwave-84",
        name: "Synthwave '84",
        colors: { primary: "#f97e72", accent: "#36f9f6", bg: "#2b213a", content: "#f0e4fc" }
    },
    {
        id: "one-dark",
        name: "One Dark",
        colors: { primary: "#61afef", accent: "#98c379", bg: "#282c34", content: "#abb2bf" }
    },
    {
        id: "midnight",
        name: "Midnight",
        colors: { primary: "#82aaff", accent: "#c3e88d", bg: "#0F111A", content: "#b4c2db" }
    }
]

function applyTheme(themeId) {
    document.documentElement.setAttribute("data-theme", themeId)
}

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

function ThemeCard({ theme, active, onClick }) {
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
