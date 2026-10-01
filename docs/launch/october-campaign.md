# Flowtake: October 2026 discovery campaign

Target: **100 total GitHub stars by November 1, 2026, 00:00 Asia/Bangkok**.
Starting count, verified October 1: **7 stars**. That means 93 additional net
stars, averaging three per day across 31 days. This is a goal, not a forecast.

## Positioning

Lead with the useful workflow: **a free, open-source screen recorder and
timeline editor for developer demos, with editable cursor-driven zoom and local
MP4 or WebM export**. Point people to the repository and official downloads.
Windows is the primary validated target; macOS and Linux remain previews.
Install system FFmpeg separately.

The published download is v1.7.2. Recorder readiness and the packaged caption
runtime improvements on `main` are **in development**, not part of that
download. Do not announce a new desktop release without building and testing
its actual artifacts. A screenshot of QA or a mock interface is not a demo of
the published app.

## Work scheduled for the month

| Dates (Bangkok) | Deliverable | Distribution | Checkpoint: total stars |
| --- | --- | --- | --- |
| Oct 1–7 | Publish refreshed website, README discovery links, and an October project announcement. Prepare a synthetic Windows recording-to-export demo. | GitHub and project website; one announcement on an authorized social account | 30 by Oct 8 |
| Oct 8–14 | Show one useful workflow: explain a bug fix in 30–45 seconds using cursor zoom and trims. Include tested version and setup steps. | One workflow post; an authorized developer community with verified rules | 55 by Oct 15 |
| Oct 15–21 | Explain a real engineering fix: how packaged ONNX runtime assets work under a strict script policy. Clearly distinguish source improvements from the download. | DEV article or an authorized technical account; respond to questions | 80 by Oct 22 |
| Oct 22–31 | Share a tested improvement driven by actual feedback. Offer two concrete contributor tasks from the current issue tracker. Publish an honest results update. | GitHub, website, and the channels that produced useful feedback | 100 by Nov 1 |

Checkpoints are planning targets, not predicted outcomes. At each checkpoint,
review installation problems and feedback before increasing distribution. If a
post receives visits but few people try the app, improve setup and the demo.
If discovery remains low, change the audience or the technical story rather
than reposting the same announcement.

## Demo production brief

Use the exact published Windows build in a clean test profile with synthetic
content. Record a small public example, add one cursor zoom and one trim, then
export a playable MP4 with synthetic audio. Verify the complete export and
review every frame. The current macOS QA issue does not provide a verified
capture/export demo; do not publish the private local diagnostic captures.
Text announcements can go ahead without claiming a completed demo.

## Reach needed: planning scenarios

To earn 93 more stars, a hypothetical 2%, 5%, or 10% visitor-to-star rate would
require about 4,650, 1,860, or 930 qualified repository visitors respectively.
These percentages are assumptions, not measured Flowtake conversion rates.
At baseline, GitHub reported 87 views and 40 unique visitors in its rolling
14-day window. Current discovery needs to grow substantially for this target.

## Measurement

Run `node scripts/promotion-metrics.mjs artifacts/promotion/YYYY-MM-DD.json`
after each publication and at the weekly checkpoints. Authenticate `gh` with
repository traffic access to include rolling views and clones. Missing traffic
access is reported as unavailable, never as zero.

Keep private traffic snapshots in ignored `artifacts/`, not in public commits.
Record the date, account, publication URL, specific workflow, relevant feedback,
and follow-up issue for each post. GitHub does not attribute stars to posts;
do not claim that a traffic spike establishes a conversion rate.

| Date | Channel / account | Publication URL | Follow-up |
| --- | --- | --- | --- |
| Oct 1 | GitHub / JNX03 | Add the October announcement URL after publication | Record baseline and installation feedback |
| Oct 1 | GitHub Pages | https://jnx03.github.io/Flowtake/ | Verify live desktop/mobile links after deployment |

## Channel decisions

GitHub and the project website are the owned launch surfaces. Social drafts
are in [october-social-posts.md](october-social-posts.md); publish only to
destinations the maintainer names. No paid ads or outbound direct messages are
part of this campaign.

For Reddit, recheck the exact community rules and any required promotion
thread or flair immediately before posting. The r/opensource rules could not
be read completely in the October 1 browser check, so its posting eligibility
has not been established. Do not treat an old draft as permission to publish.

[Hacker News guidelines](https://news.ycombinator.com/newsguidelines.html)
require human-written submissions and prohibit automated posting and
soliciting engagement. Use the [human submission checklist](show-hn.md), not
generated launch copy.

[DEV's code of conduct](https://dev.to/code-of-conduct) requires disclosure of
AI assistance when used to create content. Add that disclosure and review the
technical details before publishing an assisted article.
