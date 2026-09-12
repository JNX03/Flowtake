# Flowtake marketing-site design QA

## Review target

- Selected source: `design-evidence/selected-option-product-cinema.png`
- Implementation: local Vite homepage at `http://127.0.0.1:4173/`
- Browser: the user's Chrome session
- Desktop viewport: 1440 CSS px wide; captured content area 1425 x 757 px
- Mobile viewport: 390 x 844 CSS px; captured content area 375 x 812 px
- State: default homepage, demo section, product section, free community-kit section, privacy disclosures, and mobile menu

## Comparison evidence

The source and implementation were placed into the same image before each visual judgment.

- First desktop comparison: `design-evidence/homepage-desktop-comparison-pass-1.jpg`
- Final desktop comparison: `design-evidence/homepage-desktop-comparison.jpg`
- Final focused demo comparison: `design-evidence/demo-desktop-comparison.jpg`

Supporting implementation captures:

- `homepage-mobile.jpg`
- `homepage-mobile-menu.jpg`
- `product-mobile.jpg`
- `comparison-route-mobile.jpg`
- `storyboard-route-mobile.jpg`

All source and QA captures above are tracked in `design-evidence/`.

## Iteration history

### Pass 1

The first combined desktop comparison found one P1 mismatch: the implementation headline wrapped to three lines because the left hero column was too narrow. The hero content also sat lower and farther from the release card than the selected source.

Changes made:

- Rebalanced the hero columns from a narrow-left layout to a 1.05 / 0.95 split.
- Reduced the desktop column gap and top/bottom hero padding.
- Increased the headline measure so it resolves to two lines at the reference viewport.
- Aligned the release card timing and the first visible edge of the product theatre with the source.
- Replaced the translucent sticky-header compositor with an opaque near-black surface after Chrome exposed missing navigation layers while scrolled.

### Pass 2

The second combined desktop comparison and focused demo comparison found no remaining P0, P1, or P2 visual defects. The implementation preserves the source's hierarchy, near-black palette, warm serif display type, violet accent, split hero, large product theatre, and compact navigation rhythm.

### Pass 3

The independent review raised the small-print contrast token from `#777482` to `#8d8998` (4.93:1 or better on every used surface) and raised all homepage microcopy to at least 12 px. Chrome interaction QA then exposed a sticky-header paint defect after an in-page anchor click. The header now uses an opaque surface and its own isolated compositor layer; a real `Demo` navigation click was repeated and the complete navigation remained painted at the destination.

## Rubric results

- Typography: passed. Display hierarchy, serif/sans contrast, line length, weight, and mobile scaling match the selected direction.
- Spacing and layout: passed. No clipped sections, overlapping controls, or unexplained white gaps were found at desktop or 390 px mobile.
- Color and borders: passed. The near-black canvas, soft violet surfaces, restrained borders, and muted secondary text are consistent with the source.
- Image fidelity: passed. Generated raster assets fit their measured slots and carry explicit concept labels. No placeholder boxes, CSS drawings, or fake product screenshots are presented as evidence.
- Copy and content: updated September 12, 2026. Paid-service, checkout, and intake copy were removed. The page now presents the MIT app and free community demo kit only, while retaining platform, signing, local-first, explicit-network-feature, and public-contribution boundaries.
- Responsiveness: passed in Computer at desktop and a 390 x 844 viewport override. The homepage and both shared routes kept their document width within the viewport; hero buttons, release card, menu, comparison cards, and storyboard rows remained usable.
- Interactions: passed. The mobile menu expanded with the expected navigation links, and the storyboard copy action returned its success status. The intake dialog no longer exists; community actions are ordinary links, and the copy controls retain a manual fallback.
- Accessibility structure: passed in the fresh September 12 browser review. The page retains a skip link, one `h1`, sequential section headings, semantic landmarks, native disclosure controls, and labelled navigation and copy actions.
- Shared-route regression: passed. The Screen Studio comparison and developer-tool storyboard routes rendered at desktop and 390 x 844 mobile with no horizontal overflow, failed images, or page-origin console warnings/errors.

## Intentional truth-preserving differences

- The source's `Watch the 42-second demo` control is implemented as `View the 42-second demo plan` until real isolated-session footage exists.
- The site is configured for the release-gated v1.7.1 page and checksum link instead of implying that a concept frame is recorded product footage. Pages must remain blocked until that exact release exists.
- Every generated product scene is labeled as a concept illustration, not customer work or a finished video.

## Remaining P3 follow-up

- Replace the labeled concept frames with privacy-reviewed real Flowtake footage after the isolated demo-capture environment passes its release and security checks.

Current result: 13/13 site tests, the Pages-mode production build, built-site verification, and fresh Computer desktop/mobile review passed on September 12, 2026. Real privacy-reviewed product-demo footage remains pending because native-app control was unavailable in the Computer session.
