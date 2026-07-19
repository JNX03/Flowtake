# Flowtake marketing-site QA evidence

## Current working state

- Branch: `feature/product-site-v2`
- Base commit: `1fe157681147d4b907878e4bf3a453870c12e24b`
- Status: uncommitted working-tree changes
- Publication state: no PR, merge, deployment, domain, or launch approval

This file records automated evidence only. It does not reuse browser observations
or screenshots from an earlier commit as evidence for this working state.

## Automated evidence

- Website tests: 30/30 passed.
- Full repository tests: 162/162 passed.
- Targeted ESLint: passed with no reported errors or warnings.
- GitHub Pages-mode production build: passed.
- Built-site verifier: passed for the homepage, Windows comparison, and storyboard routes.
- Reviewed-media verifier: passed in the intentional inactive and fail-closed state.
- Production artifact guard: passed; local recording-review code, filename, query, CSS, and instructions are absent.
- `git diff --check`: passed.

## Current truth boundary

Reviewed product media remains inactive. The public homepage therefore uses the
published v1.6.0 release card as product evidence. The local recording guide is
available only in a development build on a loopback hostname with its exact
operator-review query; Pages production artifacts contain none of that private
handoff.

The complete local app remains free and MIT licensed. Flowtake Cloud is described
only as planned software. Its price and limits are hypotheses, and enrollment,
uploads, billing, native desktop upload, project sync, and realtime collaboration
are not represented as available.

## Visual QA status

Visual browser QA is **pending** for this exact uncommitted working state. No
desktop, mobile, overflow, focus, console, or interaction result is claimed here
until the rebuilt local preview is exercised and captured from the same state.
Genuine media integration and its normal-speed, frame-by-frame, and second review
also remain pending.

Current result: automated gates passed; current-state visual QA and genuine-media
review are still required before design, domain, or launch approval.
