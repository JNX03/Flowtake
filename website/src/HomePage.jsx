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
import { useEffect, useRef, useState } from "react";
import { BriefDialog } from "./BriefDialog.jsx";
import { sendEvent } from "./intake.js";

const CONTACT_EMAIL = "jnxstartup@gmail.com";
const RELEASE_VERSION = "1.6.0";
const RELEASE_URL = `https://github.com/JNX03/Flowtake/releases/tag/v${RELEASE_VERSION}`;
const DOWNLOAD_URL = "https://github.com/JNX03/Flowtake/releases/latest";
const REPOSITORY_URL = "https://github.com/JNX03/Flowtake";
const PUBLIC_STORYBOARD_URL = "https://github.com/JNX03/Flowtake/discussions/169";
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
    body: "Export a local AVC MP4. Mediabunny handles video encoding on your machine; the current edited export is video-only.",
    image: "marketing/local-export.webp",
    alt: "Abstract illustration of a local MP4 export file",
  },
];

const productFacts = [
  {
    title: "Free",
    body: "Download and use the desktop app at no charge.",
    icon: ShieldCheckIcon,
  },
  {
    title: "MIT licensed",
    body: "Inspect, fork, and use the published source commercially.",
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

const deliverables = [
  "Four 30–90 second release demos each paid month",
  "One 16:9 master and one social cutdown per demo",
  "Captions, cursor treatment, and scene cleanup",
  "Private review and one focused revision",
];

const faqs = [
  {
    question: "Is Flowtake really free?",
    answer:
      "Yes. The published recorder and editor are free and MIT-licensed. Release Studio is optional human production help; it does not remove features from the open-source app.",
  },
  {
    question: "What can I record?",
    answer:
      "Flowtake can capture a full screen, a window, or a selected area with optional camera, microphone, and supported system audio. Platform support varies, so review the current release notes before installing.",
  },
  {
    question: "Where do projects and exports go?",
    answer:
      "Ordinary projects and MP4 exports stay on your machine. Flowtake is local-first, not fully offline: update checks and any explicitly networked feature still use the network.",
  },
  {
    question: "Does it work on macOS or Linux?",
    answer:
      "Preview builds are published for macOS and Linux. macOS is ad-hoc signed but not notarized, and pure Wayland capture is unsupported. Windows is the primary validated platform today.",
  },
  {
    question: "What is Release Studio?",
    answer:
      "It is an optional $99/month founding service for teams that want four short release-demo packages, each with a 16:9 master, a social cutdown, private review, and one focused revision. Scope is confirmed in writing before checkout.",
  },
];

function track(name) {
  void sendEvent(name);
}

export function HomePage() {
  const [briefOpen, setBriefOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const briefTriggerRef = useRef(null);

  const openBrief = (trigger) => {
    track("brief_opened");
    briefTriggerRef.current = trigger instanceof HTMLElement ? trigger : document.activeElement;
    setMobileOpen(false);
    setBriefOpen(true);
  };

  useEffect(() => {
    track("page_viewed");
  }, []);

  useEffect(() => {
    if (!mobileOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [mobileOpen]);

  const backgroundState = briefOpen ? { inert: true, "aria-hidden": "true" } : {};

  return (
    <div className="site-shell home-page">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>

      <header className="home-header" {...backgroundState}>
        <a className="home-brand" href="#top" aria-label="Flowtake home">
          <img src={assetUrl("logo.svg")} alt="" />
          <span>Flowtake</span>
        </a>

        <nav className="home-desktop-nav" aria-label="Primary navigation">
          <a href="#product">Product</a>
          <a href="#demo">Demo</a>
          <a href="#open-source">Open source</a>
          <a href="#founding-plan">Release Studio</a>
          <a href="#faq">FAQ</a>
        </nav>

        <div className="home-header-actions">
          <a
            className="home-header-github"
            href={REPOSITORY_URL}
            target="_blank"
            rel="noreferrer"
            onClick={() => track("github_clicked")}
          >
            GitHub
          </a>
          <a
            className="home-button home-button-small home-button-primary"
            href={DOWNLOAD_URL}
            target="_blank"
            rel="noreferrer"
            onClick={() => track("download_clicked")}
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
            <a href="#founding-plan" onClick={() => setMobileOpen(false)}>Release Studio</a>
            <a href="#faq" onClick={() => setMobileOpen(false)}>FAQ</a>
            <a href={REPOSITORY_URL} target="_blank" rel="noreferrer" onClick={() => track("github_clicked")}>GitHub</a>
            <a href={DOWNLOAD_URL} target="_blank" rel="noreferrer">Download current release</a>
          </nav>
        )}
      </header>

      <main id="main-content" {...backgroundState}>
        <section className="home-hero home-section" id="top">
          <div className="home-hero-copy">
            <p className="home-chip">Free MIT-licensed desktop app</p>
            <h1>
              Record the build.
              <span>Show what <em>changed.</em></span>
            </h1>
            <p className="home-hero-lede">
              Capture an IDE, terminal, browser, or desktop source. Edit the take on a timeline, add captions or redaction, and export a local MP4.
            </p>
            <div className="home-hero-actions">
              <a
                className="home-button home-button-primary"
                href={DOWNLOAD_URL}
                target="_blank"
                rel="noreferrer"
                onClick={() => track("download_clicked")}
              >
                <ArrowDownTrayIcon aria-hidden="true" />
                Download free
              </a>
              <a className="home-button home-button-secondary" href="#demo">
                View the 42-second demo plan
              </a>
            </div>
            <p className="home-platform-line">
              Free · MIT licensed · Windows primary
              <span>macOS / Linux preview · unsigned Windows builds</span>
            </p>
          </div>

          <aside className="home-release-card" aria-label={`Flowtake v${RELEASE_VERSION} published release`}>
            <div className="home-release-meta">
              <span>Published desktop release</span>
              <span><CheckBadgeIcon aria-hidden="true" /> July 16, 2026</span>
            </div>
            <div className="home-release-main">
              <img src={assetUrl("logo.png")} alt="" />
              <div>
                <p>Free and MIT licensed</p>
                <h2>
                  Flowtake
                  <br />
                  {`v${RELEASE_VERSION}`}
                </h2>
                <span>Recorder, editable timeline, captions, cursor treatment, redaction, and local MP4 export.</span>
              </div>
            </div>
            <a href={RELEASE_URL} target="_blank" rel="noreferrer" onClick={() => track("github_clicked")}>
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
            <h2 id="product-title">From raw capture to local MP4.</h2>
            <span>Three clear steps from source selection to final MP4.</span>
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
            Windows artifacts are unsigned. macOS is ad-hoc signed but not notarized; macOS and Linux remain preview builds. Pure Wayland capture is unsupported. Review the current release notes and checksums before installing.
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
              Use, inspect, fork, and improve Flowtake. The optional production service is separate from the published application.
            </p>
            <a
              className="home-inline-link"
              href={REPOSITORY_URL}
              target="_blank"
              rel="noreferrer"
              onClick={() => track("github_clicked")}
            >
              View the repository <ArrowRightIcon aria-hidden="true" />
            </a>
            <a className="home-inline-link" href={`${import.meta.env.BASE_URL}screen-studio-alternative-windows/`}>
              Compare Flowtake with Screen Studio on Windows
            </a>
          </div>
        </section>

        <section className="home-service home-section" id="founding-plan" aria-labelledby="service-title">
          <div className="home-service-copy">
            <p>Optional human production help</p>
            <h2 id="service-title">Release Studio</h2>
            <span>For teams that want finished release-demo assets without another editing queue.</span>
          </div>
          <div className="home-service-price">
            <strong>$99</strong>
            <span>/ month · founding rate</span>
          </div>
          <ul>
            {deliverables.map((item) => (
              <li key={item}><CheckIcon aria-hidden="true" /> {item}</li>
            ))}
          </ul>
          <div className="home-service-action">
            <button className="home-button home-button-secondary" type="button" onClick={(event) => openBrief(event.currentTarget)}>
              Request a sample storyboard <ArrowRightIcon aria-hidden="true" />
            </button>
            <p>
              Recurring only after written scope confirmation. Cancel before renewal. No checkout or customer-file upload is open today.
            </p>
          </div>
        </section>

        <section className="home-trust home-section" id="trust" aria-labelledby="trust-title">
          <header className="home-section-heading home-section-heading-compact">
            <p>Before payment or footage</p>
            <h2 id="trust-title">The boundaries are part of the product.</h2>
          </header>
          <div className="home-disclosure-list">
            <details id="service-terms">
              <summary>Scope and delivery <ChevronDownIcon aria-hidden="true" /></summary>
              <div>
                <p>Four 30–90 second demos per paid month, each with one 16:9 master, one social cutdown, and one consolidated revision. The first cut is due within three business days after a usable brief and sanitized capture; the revision is due within two business days.</p>
                <p>Source footage should be no more than 10 minutes per demo. Voiceover production, stock licensing, custom animation, and unused monthly capacity are excluded unless agreed separately.</p>
              </div>
            </details>
            <details id="cancellation-policy">
              <summary>Billing, cancellation, and refunds <ChevronDownIcon aria-hidden="true" /></summary>
              <div>
                <p>The founding pilot is $99 USD, recurring monthly only after written scope acceptance. Cancel before the next renewal to stop future billing; access continues through the paid period.</p>
                <p>Work already started is normally non-refundable. If Flowtake cannot begin or meet the agreed delivery window, the affected order is refunded. Taxes and any future price change must be shown before checkout.</p>
              </div>
            </details>
            <details id="data-handling">
              <summary>Content, IP, and file handling <ChevronDownIcon aria-hidden="true" /></summary>
              <div>
                <p>Never submit credentials, customer data, private repositories, or production access. Customer footage is accepted only through an approved access-controlled path—not the current VPS—and working copies are deleted within 30 days after delivery unless a shorter period is agreed.</p>
                <p>After payment, the customer owns the custom delivered master and cutdown. Flowtake retains its MIT app and pre-existing templates. Nothing enters a public portfolio without written permission.</p>
              </div>
            </details>
            <details id="privacy">
              <summary>Privacy and business contact <ChevronDownIcon aria-hidden="true" /></summary>
              <div>
                <p>Lead requests send your name, work email, company, optional public URL and target date, release story, and consent record to Flowtake's HTTPS intake service. Lead records are encrypted at rest and declined or inactive leads are deleted within 90 days.</p>
                <p>This page sends cookie-free aggregate counts for a short allowlist of actions. The service stores only UTC day, action name, and count—not event details, page URLs, device identifiers, or form content. IP addresses are used only in server memory for abuse-rate limiting. No nonessential cookies are used.</p>
                <p>Flowtake is operated from Thailand. Formal contracting identity and address will be disclosed before payment. Contact <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. Direct email response is still being verified; the <a href={PUBLIC_STORYBOARD_URL} target="_blank" rel="noreferrer">public storyboard clinic</a> is currently reply-capable. Thailand PDPA and customer-specific data terms will be reviewed before private footage is accepted.</p>
              </div>
            </details>
          </div>
          <p className="home-trust-status">
            <LockClosedIcon aria-hidden="true" /> Checkout remains disabled until the secure review path and final contracting details are verified.
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
            onClick={() => track("download_clicked")}
          >
            <ArrowDownTrayIcon aria-hidden="true" /> Download free
          </a>
        </section>
      </main>

      <footer className="home-footer" {...backgroundState}>
        <div className="home-brand">
          <img src={assetUrl("logo.svg")} alt="" />
          <span>Flowtake</span>
        </div>
        <p>Free, open-source screen recorder and editor.</p>
        <nav aria-label="Footer navigation">
          <a href={REPOSITORY_URL} target="_blank" rel="noreferrer" onClick={() => track("github_clicked")}>GitHub</a>
          <a href={`${import.meta.env.BASE_URL}developer-tool-demo-storyboard/`}>Storyboard guide</a>
          <a href="#service-terms">Terms</a>
          <a href="#privacy">Privacy</a>
          <a href="#cancellation-policy">Cancellation</a>
          <a href={`mailto:${CONTACT_EMAIL}`}>Contact</a>
        </nav>
      </footer>

      {briefOpen && (
        <BriefDialog
          onClose={() => setBriefOpen(false)}
          restoreFocusTo={briefTriggerRef.current}
        />
      )}
    </div>
  );
}
