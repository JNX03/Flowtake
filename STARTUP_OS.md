# Flowtake Startup Operating System

## Objective

Turn Flowtake into a launched open-source freemium business by 2026-08-15, maximizing legitimate revenue with a target of at least $300 MRR and no more than $50 of discretionary spend.

## Product Today

Flowtake is a local, cross-platform desktop screen recorder and editor built with Tauri, React, Rust, Pixi.js, and FFmpeg. Its strongest existing promise is Screen Studio-style automatic zoom and polish for Windows, macOS, and Linux users who want local-first recording.

The paid wedge, target segment, pricing, and hosted purchase flow remain provisional until the market screen and customer-signal research are complete.

## Operating Rules

- Keep the core recorder useful under an open-source license; monetize convenience, advanced workflows, support, teams, or commercial add-ons.
- Treat the repository, live endpoints, Stripe dashboard, GitHub, VPS, and browser-visible state as separate sources of truth. Verify each before claiming completion.
- Preserve existing dirty work and unrelated branches. Make launch work on a dedicated `feature/` branch and integrate deliberately.
- Do not spend money, purchase a domain, or change billing/account plans without an explicit approval recorded in the activity log.
- Do not publish unsupported performance, platform, privacy, revenue, user-count, or competitive claims.
- Keep credentials only in ignored local files. Never commit prospects' personal contact data or authentication secrets.
- Use public professional signals for prospecting; never imply that a prospect has consented or agreed to buy.
- Record every external post, account, purchase, outreach message, deploy, and customer reply with a timestamp and evidence link.

## Daily Loop

1. Read `startup_ops/STATE.md` and the last entries in `startup_ops/ACTIVITY_LOG.md`.
2. Check live product, revenue, funnel, support, and campaign evidence.
3. Choose the highest-impact reversible action.
4. Execute, verify, and log it.
5. Once per Bangkok day, request focused human validation on Discord and continue useful work while waiting.
6. Update the next action and blockers before yielding or sleeping.

## Durable Files

- `startup_ops/STATE.md` — current truth and next actions.
- `startup_ops/ACTIVITY_LOG.md` — append-only operational history.
- `startup_ops/DECISIONS.md` — important choices, assumptions, and reversals.
- `startup_ops/EXPERIMENTS.md` — growth and product experiments.
- `startup_ops/METRICS.csv` — daily funnel and revenue snapshot.
- `startup_ops/private/` — ignored prospect/contact working files.
- `.env` — ignored startup credentials and operator webhook.

## Automation

The active Codex heartbeat is `Flowtake 30-day operator loop`. It resumes this task every 30 minutes, continues the highest-impact safe work, updates durable state, and sends at most one focused Discord validation request per Bangkok calendar day.
