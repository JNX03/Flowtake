import eslintJs from "@eslint/js"
import reactQuery from "@tanstack/eslint-plugin-query"
import reactPlugin from "eslint-plugin-react"
import reactHooks from "eslint-plugin-react-hooks"
import reactRefresh from "eslint-plugin-react-refresh"
import globals from "globals"

const webApiGlobals = {
  AudioContext: "readonly",
  OffscreenCanvas: "readonly",
  VideoFrame: "readonly",
  WritableStream: "readonly",
  createImageBitmap: "readonly",
  structuredClone: "readonly",
}

export default [
  {
    ignores: [
      "**/node_modules",
      "**/dist",
      "**/out",
      "**/.webpack",
      "**/.vite",
      "**/.claude/**",
      "**/build",
      "**/target/**",
      "**/coverage",
      "**/*.min.js",
      "**/vendor/**",
      "**/package-lock.json",
      "**/*.d.ts"
    ]
  },
  {
    files: ["**/*.{js,jsx,mjs}"],
    ...eslintJs.configs.recommended,
    languageOptions: {
      ...eslintJs.configs.recommended.languageOptions,
      globals: {
        ...globals.browser,
        ...globals.worker,
        ...webApiGlobals,
      },
    },
    rules: {
      ...eslintJs.configs.recommended.rules,
      "no-empty": ["warn", { allowEmptyCatch: true }],
      "no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
      }],
    },
  },
  {
    files: [
      "**/*.config.mjs",
      "eslint.config.mjs",
      "scripts/**/*.mjs",
      "test/**/*.{js,mjs}",
      "tests/**/*.{js,mjs}",
    ],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    files: ["**/*.jsx"],
    ...reactPlugin.configs.flat.recommended,
    rules: {
      ...reactPlugin.configs.flat.recommended.rules,
      "react/no-unescaped-entities": "off",
      "react/prop-types": "off",
    },
  },
  {
    files: ["**/*.jsx"],
    ...reactPlugin.configs.flat['jsx-runtime'],
    rules: {
      ...reactPlugin.configs.flat['jsx-runtime'].rules,
      "react/prop-types": "off",
    },
  },
  {
    files: ["**/*.jsx"],
    ...reactHooks.configs.flat.recommended,
    rules: {
      ...reactHooks.configs.flat.recommended.rules,
      "react-hooks/immutability": "off",
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/static-components": "off",
    },
  },
  {
    files: ["**/*.jsx"],
    ...reactRefresh.configs.vite,
    rules: {
      ...reactRefresh.configs.vite.rules,
      "react-refresh/only-export-components": "warn",
    },
  },
  ...reactQuery.configs['flat/recommended'].map(config => ({
    files: ["**/*.jsx"],
    ...config,
    rules: {
      ...config.rules,
      "@tanstack/query/exhaustive-deps": "warn",
    },
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
