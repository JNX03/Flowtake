# Flowtake marketing-site design QA

## Current review target

- Branch: `feature/product-site-v2`
- Reviewed commit: `586d3c390e0f09a45e84ae2607977637cb256f16`
- Local Pages preview: `http://127.0.0.1:4174/Flowtake/`
- Viewports exercised: 1440, 941, 940, 700, and 390 CSS px
- Routes exercised: homepage, Screen Studio comparison, and developer-tool storyboard
- State exercised: default homepage, mobile menu, request dialog, and open privacy disclosure

## Truth boundary

This branch intentionally renders no product video, Demo navigation item, demo CTA, product-media theatre, generated screenshot, or placeholder while the reviewed-media manifest is inactive. The hero uses the published v1.6.0 release as the current product evidence. Record, Edit, and Export remain factual text summaries.

The earlier screenshot set was removed because it represented an older serif/concept-media pass and could not be used as evidence for the current Poppins/direct-copy build. New review captures must not be committed until genuine isolated-session footage passes privacy, truth, and second review.

## Interim browser QA

- Typography and hierarchy: passed for the direct Poppins product-site direction.
- Layout: no clipped sections, overlapping controls, unexplained white gaps, or horizontal overflow were found across the exercised viewports.
- Responsive navigation: desktop navigation remains present at 941 px; the mobile trigger takes over at 940 px and below.
- Mobile menu: open and close paths passed.
- Request dialog: opens with focus inside, closes with Escape, restores trigger focus, and restores body scrolling.
- Privacy disclosure: remains open and directly reachable from the consent path.
- Accessibility structure: skip link, one `h1`, sequential headings, landmarks, visible focus states, native FAQ controls, reduced-motion handling, and explicit form status/error regions remain present.
- Shared routes: comparison and storyboard routes rendered without overflow, failed local assets, or page-origin console errors.
- Console: no page-origin warning or error was observed in the exercised paths.
- Product evidence: no placeholder, concept art, queued-demo promise, or hidden RapidDemo reference appeared.

## Automated gates

- Website tests: 28/28 passed.
- Full repository tests: 159/159 passed.
- Documentation truth tests: 2/2 passed.
- ESLint: 0 errors; 41 pre-existing warnings.
- Pages-mode production build: passed.
- Built-site verifier: passed for all three routes.
- Reviewed-media verifier: passed in the intentional inactive/fail-closed state.
- Current-main export-truth hardening is included without weakening its adversarial guard or tests.

## Remaining launch review

This is an interim no-media QA result, not finished design approval and not launch approval.

After the genuine `flowtake-demo-source.mp4` is received:

1. Complete normal-speed and frame-by-frame privacy/truth review.
2. Derive and independently review the exact seven public candidates.
3. Activate the reviewed-media manifest and repeat the full automated suite.
4. Repeat desktop/mobile browser QA, including real video loading, fallback download, captions, reduced motion, and every public route.
5. Capture a fresh evidence set from that exact reviewed commit.
6. Send the finished design/domain/launch handoff for operator approval.

Current result: interim fail-closed build passed; genuine-media review pending.
