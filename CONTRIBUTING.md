# Contributing to Flowtake

Thank you for your interest in contributing to Flowtake! This guide will help you get started.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Architecture](#project-architecture)
- [How to Contribute](#how-to-contribute)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Commit Convention](#commit-convention)
- [Reporting Bugs](#reporting-bugs)
- [Requesting Features](#requesting-features)
- [Community](#community)

## Code of Conduct

This project adheres to a [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to [jn03official@gmail.com](mailto:jn03official@gmail.com).

## Getting Started

### Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| [Node.js](https://nodejs.org/) | 18+ | Frontend tooling |
| [Rust](https://www.rust-lang.org/tools/install) | Stable | Backend compilation |
| [Tauri CLI](https://v2.tauri.app/start/prerequisites/) | v2 | Desktop app framework |
| Git | Latest | Version control |

### Development Setup

```bash
# 1. Fork and clone the repository
git clone https://github.com/<your-username>/Flowtake.git
cd Flowtake

# 2. Add upstream remote
git remote add upstream https://github.com/Jnx03/Flowtake.git

# 3. Install dependencies
npm install

# 4. Start development server
npm run dev
```

This launches both the Vite dev server (frontend hot-reload) and the Tauri development window.

### Useful Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Full Tauri + Vite dev mode |
| `npm run dev:frontend` | Frontend only (port 5173) |
| `npm run build` | Production build (NSIS/MSI) |
| `npm run lint` | Lint JavaScript/JSX files |

## Project Architecture

```
Flowtake/
├── app/                      # React frontend
│   ├── shared/               # Shared code (redux, scene, workers)
│   ├── components/           # Shared UI components
│   └── windows/              # Per-window entry points
├── src-tauri/                # Rust backend
│   └── src/commands/         # IPC command handlers
├── resources/                # Bundled binaries
└── vite.config.mjs           # Build configuration
```

For detailed architecture docs, see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

### Key Concepts

- **Tauri Commands** — Backend functions exposed to the frontend via IPC. Located in `src-tauri/src/commands/`.
- **Redux Slices** — Each feature (zooms, pans, clicks, clips, masks, etc.) has its own Redux slice in `app/shared/redux/`.
- **Scene Modules** — Pixi.js rendering logic for each animation type lives in `app/shared/scene/`.
- **Tauri Bridge** — `app/shared/tauriBridge.js` maps IPC calls between the frontend and Rust backend.
- **Multi-Window** — The app uses separate windows (main, recorder, exporter, pickers) that share code via `app/shared/`.

## How to Contribute

### Types of Contributions

| Type | Description |
|------|-------------|
| **Bug fixes** | Fix reported issues or edge cases |
| **Features** | Add new functionality (discuss first in an issue) |
| **Documentation** | Improve README, guides, code comments |
| **Tests** | Add or improve test coverage |
| **Performance** | Optimize rendering, encoding, or startup time |
| **Accessibility** | Improve keyboard navigation, screen reader support |
| **Translations** | Help localize the UI |

### First-Time Contributors

Look for issues labeled **`good first issue`** or **`help wanted`**. These are curated to be approachable for newcomers.

Suggested first contributions:
- Fix a UI bug in a component
- Improve an error message
- Add a missing tooltip or label
- Write documentation for a feature

## Pull Request Process

### 1. Create a Branch

```bash
# Sync with upstream
git fetch upstream
git checkout main
git merge upstream/main

# Create your branch
git checkout -b feature/your-feature-name
```

**Branch naming convention:**

| Prefix | Use for |
|--------|---------|
| `feature/` | New features |
| `fix/` | Bug fixes |
| `docs/` | Documentation changes |
| `refactor/` | Code refactoring |
| `test/` | Test additions |
| `perf/` | Performance improvements |

### 2. Make Your Changes

- Keep changes focused — one feature or fix per PR
- Follow the [coding standards](#coding-standards)
- Test your changes locally with `npm run dev`
- Run `npm run lint` before committing

### 3. Write a Good Commit

Follow the [commit convention](#commit-convention). Each commit should be atomic and describe a single logical change.

### 4. Submit Your PR

```bash
git push origin feature/your-feature-name
```

Then open a Pull Request against the `main` branch. In your PR description:

- **Describe what changed** and why
- **Link related issues** (e.g., "Closes #42")
- **Include screenshots** for UI changes
- **List testing steps** you performed

### 5. Review Process

- A maintainer will review your PR
- Address any requested changes
- Once approved, a maintainer will merge your PR

## Coding Standards

### JavaScript / React

- Use **functional components** with hooks
- Use **Redux Toolkit** patterns for state management (slices, createEntityAdapter)
- Use **TailwindCSS** utility classes for styling (no inline styles or CSS modules)
- Prefer **named exports** over default exports
- Use **camelCase** for variables/functions, **PascalCase** for components

### Rust

- Follow standard Rust conventions (`cargo fmt`, `cargo clippy`)
- Use `thiserror` for error types
- All Tauri commands go in `src-tauri/src/commands/`
- Return `Result<T, AppError>` from commands

### General

- No unused imports or variables
- No `console.log` left in production code (use proper error handling)
- Keep files focused — one component per file
- Prefer composition over inheritance

## Commit Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Formatting, no code change |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `perf` | Performance improvement |
| `test` | Adding or correcting tests |
| `chore` | Build process, tooling, dependencies |

### Examples

```
feat(timeline): add audio track drag-and-drop support
fix(export): resolve encoding crash on high-DPI displays
docs(readme): add development setup instructions
refactor(redux): migrate zoom slice to entity adapter
```

## Reporting Bugs

Use the [Bug Report](https://github.com/Jnx03/Flowtake/issues/new?template=bug_report.md) issue template. Include:

1. **Steps to reproduce** the bug
2. **Expected behavior** vs what actually happened
3. **System information** (OS version, app version)
4. **Screenshots or screen recordings** if applicable
5. **Error logs** from the developer console (Ctrl+Shift+I)

## Requesting Features

Use the [Feature Request](https://github.com/Jnx03/Flowtake/issues/new?template=feature_request.md) issue template. Include:

1. **Problem statement** — What problem does this solve?
2. **Proposed solution** — How should it work?
3. **Alternatives considered** — What other approaches did you think of?
4. **Mockups** — Sketches or wireframes if it's a UI change

> **Note**: For large features, please open an issue for discussion before starting work. This ensures alignment with the project direction and prevents wasted effort.

## Community

- **Issues**: [GitHub Issues](https://github.com/Jnx03/Flowtake/issues)
- **Email**: [jn03official@gmail.com](mailto:jn03official@gmail.com)

---

Thank you for helping make Flowtake better!
