import {
  ArrowDownTrayIcon,
  ArrowRightIcon,
  CheckBadgeIcon,
  CheckIcon,
  ChevronDownIcon,
  CodeBracketIcon,
  ComputerDesktopIcon,
  LockClosedIcon,
  ShieldCheckIcon,
  WindowIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useEffect, useState } from "react";

const RELEASE_VERSION = "1.7.2";
const RELEASE_URL = `https://github.com/JNX03/Flowtake/releases/tag/v${RELEASE_VERSION}`;
const DOWNLOAD_URL = "https://github.com/JNX03/Flowtake/releases/latest";
const REPOSITORY_URL = "https://github.com/JNX03/Flowtake";
const CONTRIBUTING_URL = `${REPOSITORY_URL}/blob/main/CONTRIBUTING.md`;
const SECURITY_URL = `${REPOSITORY_URL}/blob/main/SECURITY.md`;
const assetUrl = (name) => `${import.meta.env.BASE_URL}assets/${name}`;

const productFeatures = [
  {
    number: "01",
    title: "Capture the right window.",
    body: "Record an IDE, terminal, browser, full screen, or selected area. Keep the frame on the work you actually need to explain.",
    image: "marketing/capture-window.webp",
    alt: "Abstract illustration of a window capture selection",
  },
  {
    number: "02",
    title: "Shape the timeline.",
    body: "Trim, split, reorder, and refine the take without flattening it. Add captions, zoom, cursor treatment, or redaction where the explanation needs help.",
    image: "marketing/timeline-edit.webp",
    alt: "Abstract illustration of editable video clips and a timeline playhead",
  },
  {
    number: "03",
    title: "Export locally.",
    body: "Flowtake v1.7 exports H.264/MP4 or VP9/WebM locally. Mediabunny encodes the video on your device. Recorded and timeline audio are mixed into the exported file when present and enabled.",
    image: "marketing/local-export.webp",
    alt: "Abstract illustration of a local video export file",
  },
];

const productFacts = [
  {
    title: "Free",
    body: "Download and use the desktop app at no charge.",
    icon: ShieldCheckIcon,
  },
  {
    title: "MIT app code",
    body: "Inspect, fork, and use Flowtake's published source commercially.",
    icon: CodeBracketIcon,
  },
  {
    title: "Windows primary",
    body: "Validated first on Windows 10 and 11.",
    icon: WindowIcon,
  },
  {
    title: "macOS / Linux preview",
    body: "Preview builds ship with current platform limits.",
    icon: ComputerDesktopIcon,
  },
];

const communityKit = [
  "A copyable six-beat storyboard for one real workflow",
  "A safe-capture checklist for public or synthetic demo data",
  "A maintainer brief that stays in your browser until you copy it",
  "Open contribution paths for fixes, examples, and documentation",
];

const faqs = [
  {
    question: "Is Flowtake really free?",
    answer:
      "Yes. Flowtake has no paid app tier, paid studio mode, or export paywall, and Flowtake application code is MIT-licensed. Release packages do not include an FFmpeg executable; install that system dependency separately.",
  },
  {
    question: "Do I need to install FFmpeg?",
    answer:
      "Yes. Install it before opening Flowtake. On Windows run: winget install --id Gyan.FFmpeg --exact --source winget. On macOS run: brew install ffmpeg. On Linux, install your distribution's full FFmpeg package and keep ffmpeg on PATH.",
  },
  {
    question: "What can I record?",
    answer:
      "Flowtake can capture a full screen, a window, or a selected area with optional camera, microphone, and supported system audio. Platform support varies, so review the current release notes before installing.",
  },
  {
    question: "Where do projects and exports go?",
    answer:
      "In Flowtake v1.7, ordinary projects and MP4 or WebM exports stay on your machine. Flowtake is local-first, not fully offline: update checks and any explicitly networked feature still use the network.",
  },
  {
    question: "Does it work on macOS or Linux?",
    answer:
      "Preview builds are published for macOS and Linux. macOS is ad-hoc signed and not notarized. All platforms require a separately installed system FFmpeg. Pure Wayland capture is unsupported. Windows is the primary validated platform today.",
  },
  {
    question: "What is the community demo kit?",
    answer:
      "It is a free six-beat storyboard, copyable maintainer brief, and safe-capture checklist. Nothing is submitted to Flowtake when you use or copy the kit; contribute improvements through the public GitHub repository after removing private data.",
  },
];

export function HomePage() {
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!mobileOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [mobileOpen]);

  return (
    <div className="site-shell home-page">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>

      <header className="home-header">
        <a className="home-brand" href="#top" aria-label="Flowtake home">
          <img src={assetUrl("logo.svg")} alt="" />
          <span>Flowtake</span>
        </a>

        <nav className="home-desktop-nav" aria-label="Primary navigation">
          <a href="#product">Product</a>
          <a href="#demo">Demo</a>
          <a href="#open-source">Open source</a>
          <a href="#community">Community kit</a>
          <a href="#faq">FAQ</a>
        </nav>

        <div className="home-header-actions">
          <a
            className="home-header-github"
            href={REPOSITORY_URL}
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
          <a
            className="home-button home-button-small home-button-primary"
            href={DOWNLOAD_URL}
            target="_blank"
            rel="noreferrer"
          >
            Download free
          </a>
          <button
            className="home-menu-button"
            type="button"
            aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={mobileOpen}
            aria-controls="home-mobile-navigation"
            onClick={() => setMobileOpen((value) => !value)}
          >
            {mobileOpen ? <XMarkIcon aria-hidden="true" /> : <span>Menu</span>}
          </button>
        </div>

        {mobileOpen && (
          <nav className="home-mobile-nav" id="home-mobile-navigation" aria-label="Mobile navigation">
            <a href="#product" onClick={() => setMobileOpen(false)}>Product</a>
            <a href="#demo" onClick={() => setMobileOpen(false)}>Demo</a>
            <a href="#open-source" onClick={() => setMobileOpen(false)}>Open source</a>
            <a href="#community" onClick={() => setMobileOpen(false)}>Community kit</a>
            <a href="#faq" onClick={() => setMobileOpen(false)}>FAQ</a>
            <a href={REPOSITORY_URL} target="_blank" rel="noreferrer">GitHub</a>
            <a href={DOWNLOAD_URL} target="_blank" rel="noreferrer">Download current release</a>
          </nav>
        )}
      </header>

      <main id="main-content">
        <section className="home-hero home-section" id="top">
          <div className="home-hero-copy">
            <p className="home-chip">Free desktop app · MIT app code</p>
            <h1>
              Record the build.
              <span>Show what <em>changed.</em></span>
            </h1>
            <p className="home-hero-lede">
              Capture an IDE, terminal, browser, or desktop source. Flowtake v1.7 lets you edit the take on a timeline, add captions or redaction, and export MP4 or WebM locally.
            </p>
            <div className="home-hero-actions">
              <a
                className="home-button home-button-primary"
                href={DOWNLOAD_URL}
                target="_blank"
                rel="noreferrer"
              >
                <ArrowDownTrayIcon aria-hidden="true" />
                Download free
              </a>
              <a className="home-button home-button-secondary" href="#demo">
                View the 42-second demo plan
              </a>
            </div>
            <p className="home-platform-line">
              Free · MIT app code · Windows primary
              <span>macOS / Linux preview · unsigned Windows builds</span>
            </p>
          </div>

          <aside className="home-release-card" aria-label={`Flowtake v${RELEASE_VERSION} published release`}>
            <div className="home-release-meta">
              <span>Published desktop release</span>
              <span><CheckBadgeIcon aria-hidden="true" /> September 12, 2026</span>
            </div>
            <div className="home-release-main">
              <img src={assetUrl("logo.png")} alt="" />
              <div>
                <p>Free · MIT app code</p>
                <h2>
                  Flowtake
                  <br />
                  {`v${RELEASE_VERSION}`}
                </h2>
                <span>Recorder, adaptive previews, editable timeline, captions, cursor treatment, redaction, and local MP4 or WebM export with audio when present and enabled.</span>
              </div>
            </div>
            <a href={RELEASE_URL} target="_blank" rel="noreferrer">
              Release assets and checksums <ArrowRightIcon aria-hidden="true" />
            </a>
          </aside>
        </section>

        <section className="home-demo home-section" id="demo" aria-labelledby="demo-title">
          <div className="home-demo-theatre">
            <img
              className="home-demo-background"
              src={assetUrl("marketing/demo-theatre-background.webp")}
              alt=""
              aria-hidden="true"
              decoding="async"
            />
            <div className="home-demo-copy">
              <img src={assetUrl("logo.svg")} alt="" />
              <p>Real demo queued for isolated capture</p>
              <h2 id="demo-title">The 42-second plan is ready.</h2>
              <span>
                The recorded Flowtake footage will replace this frame only after an isolated-session privacy review.
              </span>
              <a
                className="home-button home-button-secondary"
                href={`${import.meta.env.BASE_URL}developer-tool-demo-storyboard/`}
              >
                View the capture plan <ArrowRightIcon aria-hidden="true" />
              </a>
            </div>
            <p className="home-demo-boundary">
              Concept frame—not product footage, customer work, or a finished video.
            </p>
          </div>
        </section>

        <section className="home-product home-section" id="product" aria-labelledby="product-title">
          <header className="home-section-heading">
            <p>One take. Still editable.</p>
            <h2 id="product-title">From raw capture to a local export.</h2>
            <span>Three clear steps from source selection to a final MP4 or WebM file.</span>
          </header>

          <ol className="home-feature-list">
            {productFeatures.map(({ number, title, body, image, alt }) => (
              <li key={number}>
                <figure>
                  <img src={assetUrl(image)} alt={alt} loading="lazy" decoding="async" />
                  <figcaption>Concept illustration—not product footage.</figcaption>
                </figure>
                <div className="home-feature-copy">
                  <span>{number}</span>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="home-fact-band home-section" id="open-source" aria-label="Flowtake release facts">
          {productFacts.map(({ title, body, icon: Icon }) => (
            <article key={title}>
              <Icon aria-hidden="true" />
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
          <p className="home-fact-note">
            Windows artifacts are unsigned. macOS is ad-hoc signed but not notarized; macOS and Linux remain preview builds. Flowtake release packages do not include an FFmpeg executable; install a compatible system FFmpeg separately on every platform. Pure Wayland capture is unsupported. Review the current release notes and checksums before installing.
          </p>
        </section>

        <section className="home-open-source home-section" aria-labelledby="open-source-title">
          <div className="home-open-source-mark">
            <img src={assetUrl("logo.svg")} alt="" />
            <span>MIT</span>
          </div>
          <div>
            <p>Open source, on purpose</p>
            <h2 id="open-source-title">The recorder stays free.</h2>
          </div>
          <div>
            <p>
              Use, inspect, fork, and improve Flowtake. The recorder, editor, export controls, and community demo kit are available without a paid tier.
            </p>
            <a
              className="home-inline-link"
              href={REPOSITORY_URL}
              target="_blank"
              rel="noreferrer"
            >
              View the repository <ArrowRightIcon aria-hidden="true" />
            </a>
            <a className="home-inline-link" href={`${import.meta.env.BASE_URL}screen-studio-alternative-windows/`}>
              Compare Flowtake with Screen Studio on Windows
            </a>
          </div>
        </section>

        <section className="home-community home-section" id="community" aria-labelledby="community-title">
          <div className="home-community-copy">
            <p>Free resources, shared in public</p>
            <h2 id="community-title">Community demo kit</h2>
            <span>Plan a concise product demo without submitting footage, opening an account, or entering a sales funnel.</span>
          </div>
          <div className="home-community-badge">
            <strong>Free</strong>
            <span>copy, adapt, and contribute</span>
          </div>
          <ul>
            {communityKit.map((item) => (
              <li key={item}><CheckIcon aria-hidden="true" /> {item}</li>
            ))}
          </ul>
          <div className="home-community-action">
            <a className="home-button home-button-secondary" href={`${import.meta.env.BASE_URL}developer-tool-demo-storyboard/`}>
              Open the free demo kit <ArrowRightIcon aria-hidden="true" />
            </a>
            <a className="home-inline-link" href={CONTRIBUTING_URL} target="_blank" rel="noreferrer">
              Contribute on GitHub <ArrowRightIcon aria-hidden="true" />
            </a>
            <p>
              No checkout, private upload, or lead form. GitHub issues and discussions are public, so remove credentials and private data before contributing.
            </p>
          </div>
        </section>

        <section className="home-trust home-section" id="trust" aria-labelledby="trust-title">
          <header className="home-section-heading home-section-heading-compact">
            <p>Privacy before promotion</p>
            <h2 id="trust-title">Know what stays local—and what leaves the app.</h2>
          </header>
          <div className="home-disclosure-list">
            <details id="privacy">
              <summary>Local files and explicit network features <ChevronDownIcon aria-hidden="true" /></summary>
              <div>
                <p>In Flowtake v1.7, ordinary recordings, project files, and MP4 or WebM exports stay on your device. Flowtake does not include cloud project sync.</p>
                <p>Flowtake is local-first, not fully offline. Release checks, YouTube upload, RTMP streaming, and model-asset downloads use the network only when the related feature is used.</p>
              </div>
            </details>
            <details id="website-privacy">
              <summary>Website and demo-kit privacy <ChevronDownIcon aria-hidden="true" /></summary>
              <div>
                <p>This website has no sales form, checkout, customer-file upload, or Flowtake event-analytics request. Copy buttons use your browser clipboard and do not submit the copied text to Flowtake.</p>
                <p>The site is hosted on GitHub Pages. Opening a GitHub download, issue, discussion, or repository link sends a request to GitHub under GitHub's own terms and privacy policy.</p>
              </div>
            </details>
            <details id="safe-contributions">
              <summary>Safe public contributions <ChevronDownIcon aria-hidden="true" /></summary>
              <div>
                <p>GitHub issues, pull requests, and discussions are public by default. Never post credentials, customer data, private repository details, production access, or unreviewed footage.</p>
                <p>Use public fixtures or synthetic accounts for examples. Follow the private process in SECURITY.md for vulnerability reports.</p>
              </div>
            </details>
            <details id="platform-limits">
              <summary>Platform and signing limits <ChevronDownIcon aria-hidden="true" /></summary>
              <div>
                <p>Windows 10/11 x64 is the primary validation target. macOS and Linux builds are previews, and pure Wayland capture is unsupported.</p>
                <p>Flowtake packages do not include FFmpeg. Install it separately and keep the <code>ffmpeg</code> command on <code>PATH</code>.</p>
                <p>Windows artifacts are not Authenticode-signed. macOS artifacts are ad-hoc signed, not notarized. Download only from the official GitHub release and verify published checksums.</p>
              </div>
            </details>
          </div>
          <p className="home-trust-status">
            <LockClosedIcon aria-hidden="true" /> Sanitize every screenshot, log, browser tab, filename, and notification before sharing a demo or contribution.
          </p>
        </section>

        <section className="home-faq home-section" id="faq" aria-labelledby="faq-title">
          <header>
            <p>Questions before the first take</p>
            <h2 id="faq-title">Plain answers.</h2>
          </header>
          <div>
            {faqs.map((item) => (
              <details key={item.question}>
                <summary>{item.question}<ChevronDownIcon aria-hidden="true" /></summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="home-final-cta home-section" aria-labelledby="final-cta-title">
          <img src={assetUrl("logo.svg")} alt="" />
          <div>
            <p>Free · open source · local-first</p>
            <h2 id="final-cta-title">Ready to record what changed?</h2>
          </div>
          <a
            className="home-button home-button-primary"
            href={DOWNLOAD_URL}
            target="_blank"
            rel="noreferrer"
          >
            <ArrowDownTrayIcon aria-hidden="true" /> Download free
          </a>
        </section>
      </main>

      <footer className="home-footer">
        <div className="home-brand">
          <img src={assetUrl("logo.svg")} alt="" />
          <span>Flowtake</span>
        </div>
        <p>Free, open-source screen recorder and editor.</p>
        <nav aria-label="Footer navigation">
          <a href={REPOSITORY_URL} target="_blank" rel="noreferrer">GitHub</a>
          <a href={`${import.meta.env.BASE_URL}developer-tool-demo-storyboard/`}>Free demo kit</a>
          <a href="#privacy">Privacy</a>
          <a href={CONTRIBUTING_URL} target="_blank" rel="noreferrer">Contributing</a>
          <a href={SECURITY_URL} target="_blank" rel="noreferrer">Security</a>
        </nav>
      </footer>
    </div>
  );
}
