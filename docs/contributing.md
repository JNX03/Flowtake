# Contributing

Contributions are welcome. Here's how to get started.

## Before You Begin

1. Check the [issues list](https://github.com/Jnx03/Flowtake/issues) to see if someone is already working on what you want to do
2. For large changes, open an issue first to discuss the approach
3. Read the [Architecture Overview](architecture/README.md) to understand the codebase

## Setup

Follow the [Development Setup](getting-started/development.md) guide to build and run Flowtake locally.

## Workflow

1. Fork the repository
2. Create a feature branch:
   ```bash
   git checkout -b feature/your-feature
   ```
3. Make your changes
4. Run the linter:
   ```bash
   npm run lint
   ```
5. Commit using [Conventional Commits](https://www.conventionalcommits.org/):
   ```
   feat: add your feature
   fix: fix a bug
   chore: update dependencies
   ```
6. Push your branch and open a Pull Request against `main`

## Code Style

- **Frontend**: ESLint is configured — run `npm run lint` before committing
- **Rust**: `cargo fmt` and `cargo clippy` before committing backend changes
- Keep components focused. The main editor has 100+ components — add new ones only when clearly needed

## Reporting Bugs

Open an issue with:
- Flowtake version
- OS and version
- Steps to reproduce
- Expected vs actual behavior
- Any relevant error messages or logs

## Security Issues

Do **not** open a public issue for security vulnerabilities. Follow the [Security Policy](../SECURITY.md) instead.
