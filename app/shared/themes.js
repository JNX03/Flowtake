export const LIGHT_THEMES = [
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

export const DARK_THEMES = [
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

export function applyTheme(themeId) {
    document.documentElement.setAttribute("data-theme", themeId)
}
