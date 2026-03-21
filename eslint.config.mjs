import eslintJs from "@eslint/js"
import reactQuery from "@tanstack/eslint-plugin-query"
import reactPlugin from "eslint-plugin-react"
import reactHooks from "eslint-plugin-react-hooks"
import reactRefresh from "eslint-plugin-react-refresh"

export default [
  {
    ignores: [
      "**/node_modules",
      "**/dist",
      "**/out",
      "**/.webpack",
      "**/.vite",
      "**/build",
      "**/coverage",
      "**/*.min.js",
      "**/vendor/**",
      "**/package-lock.json",
      "**/*.d.ts"
    ]
  },
  {
    files: ["**/*.{js,jsx}"],
    ...eslintJs.configs.recommended,
  },
  {
    files: ["**/*.jsx"],
    ...reactPlugin.configs.flat.recommended,
  },
  {
    files: ["**/*.jsx"],
    ...reactPlugin.configs.flat['jsx-runtime'],
  },
  {
    files: ["**/*.jsx"],
    ...reactHooks.configs.flat.recommended,
  },
  {
    files: ["**/*.jsx"],
    ...reactRefresh.configs.vite,
  },
  ...reactQuery.configs['flat/recommended'].map(config => ({
    files: ["**/*.jsx"],
    ...config,
  })),
  {
    files: ["**/*.jsx"],
    settings: {
      react: {
        version: "detect",
      },
    },
  },
]