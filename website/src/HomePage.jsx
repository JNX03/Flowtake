import {
  ArrowDownTrayIcon,
  ArrowRightIcon,
  CheckBadgeIcon,
  ChevronDownIcon,
  CodeBracketIcon,
  ComputerDesktopIcon,
  LockClosedIcon,
  ShieldCheckIcon,
  WindowIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { BriefDialog } from "./BriefDialog.jsx";
import { AppAndService } from "./components/AppAndService.jsx";
import {
  ReviewedDemoShowcase,
  ReviewedHeroVideo,
} from "./components/ReviewedDemoMedia.jsx";
import { PRIVACY_NOTICE_VERSION, sendEvent } from "./intake.js";
import { hasReviewedDemoMedia } from "./reviewedDemoMedia.js";

const CONTACT_EMAIL = "jnxstartup@gmail.com";
const RELEASE_VERSION = "1.6.0";
const RELEASE_URL = `https://github.com/JNX03/Flowtake/releases/tag/v${RELEASE_VERSION}`;
const DOWNLOAD_URL = "https://github.com/JNX03/Flowtake/releases/latest";
const REPOSITORY_URL = "https://github.com/JNX03/Flowtake";
const PUBLIC_STORYBOARD_URL = "https://github.com/JNX03/Flowtake/discussions/169";
const assetUrl = (name) => `${import.meta.env.BASE_URL}assets/${name}`;

const LocalDemoRecordingSlot = import.meta.env.DEV
  ? lazy(async () => {
      const module = await import("./components/DemoRecordingSlot.jsx");
      return { default: module.DemoRecordingSlot };
    })
  : null;

const productFeatures = [
  {
    number: "01",
    title: "Choose what to capture.",
    body: "Record an IDE, terminal, browser, full screen, or selected area. Keep the frame on the work you actually need to explain.",
  },
  {
    number: "02",
    title: "Edit the recording.",
    body: "Trim, split, reorder, and refine the take without flattening it. Add captions, zoom, cursor treatment, or redaction where the explanation needs help.",
  },
  {
    number: "03",
    title: "Export the finished MP4.",
    body: "Export a local AVC MP4. Mediabunny handles video encoding on your machine; the current edited export is video-only.",
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

const faqs = [
  {
    question: "Is Flowtake really free?",
    answer:
      "Yes. The published recorder, editor, and local MP4 export are free and MIT-licensed. The planned Flowtake Cloud beta is a separate hosted review layer; it does not remove or paywall local app features.",
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
    question: "What is Flowtake Cloud?",
    answer:
      "It is a planned optional beta for private video review links with expiry, revoke, delete, passcode, timestamp comments, and aggregate playback sessions. The $9/month price and limits are hypotheses; uploads, enrollment, and billing are not open yet.",
  },
];

function track(name) {
  void sendEvent(name);
}

export function HomePage() {
  const [briefOpen, setBriefOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const briefTriggerRef = useRef(null);
  const menuButtonRef = useRef(null);

  const openBrief = (trigger) => {
    track("brief_opened");
    briefTriggerRef.current = trigger instanceof HTMLElement ? trigger : document.activeElement;
    setMobileOpen(false);
    setBriefOpen(true);
  };

  const closeMobileNavigation = () => {
    setMobileOpen(false);
  };

  useEffect(() => {
    track("page_viewed");
  }, []);

  useEffect(() => {
    if (!mobileOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key !== "Escape") return;
      setMobileOpen(false);
      queueMicrotask(() => menuButtonRef.current?.focus({ preventScroll: true }));
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [mobileOpen]);

  const backgroundState = briefOpen ? { inert: true, "aria-hidden": "true" } : {};
  const hasProductDemo = hasReviewedDemoMedia;
  const productEvidenceTarget = hasReviewedDemoMedia ? "#demo" : "#product";
  const productEvidenceLabel = hasReviewedDemoMedia
    ? "Watch the real demo"
    : "See how Flowtake works";
  const releaseCard = (
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
  );

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
          {hasProductDemo && <a href={productEvidenceTarget}>Demo</a>}
          <a href="#open-source-vs-cloud">Local app vs Cloud</a>
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
            ref={menuButtonRef}
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
            <a href="#product" onClick={closeMobileNavigation}>Product</a>
            {hasProductDemo && <a href={productEvidenceTarget} onClick={closeMobileNavigation}>Demo</a>}
            <a href="#open-source-vs-cloud" onClick={closeMobileNavigation}>Local app vs Cloud</a>
            <a href="#faq" onClick={closeMobileNavigation}>FAQ</a>
            <a href={REPOSITORY_URL} target="_blank" rel="noreferrer" onClick={() => track("github_clicked")}>GitHub</a>
            <a href={DOWNLOAD_URL} target="_blank" rel="noreferrer">Download current release</a>
          </nav>
        )}
      </header>

      <main id="main-content" {...backgroundState}>
        <section className="home-hero home-section" id="top">
          <div className="home-hero-copy">
            <p className="home-chip">Open-source Windows recorder and editor</p>
            <h1>Record, edit, and export screen demos on Windows.</h1>
            <p className="home-hero-lede">
              Capture a screen, window, or area. Flowtake adds cursor-driven zooms, lets you edit on a timeline, and exports MP4 locally.
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
                Download for Windows
              </a>
              <a className="home-button home-button-secondary" href={productEvidenceTarget}>
                {productEvidenceLabel}
              </a>
            </div>
            <p className="home-platform-line">
              Windows 10/11 · WinGet and GitHub Releases
              <span>Free · MIT licensed · current Windows artifacts are unsigned</span>
            </p>
          </div>

          {hasReviewedDemoMedia ? (
            <ReviewedHeroVideo />
          ) : LocalDemoRecordingSlot ? (
            <Suspense fallback={releaseCard}>
              <LocalDemoRecordingSlot
                fallback={releaseCard}
                hasReviewedMedia={hasReviewedDemoMedia}
                locationLike={globalThis.location}
              />
            </Suspense>
          ) : releaseCard}
        </section>

        <ReviewedDemoShowcase />

        <section className="home-product home-section" id="product" aria-labelledby="product-title">
          <header className="home-section-heading">
            <p>How it works</p>
            <h2 id="product-title">Record, edit, and export in one app.</h2>
            <span>Choose the source, refine the recording on a timeline, and render the finished MP4 on your machine.</span>
          </header>

          <ol className="home-feature-list">
            {productFeatures.map(({ number, title, body }) => (
              <li key={number}>
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

        <AppAndService
          comparisonUrl={`${import.meta.env.BASE_URL}screen-studio-alternative-windows/`}
          downloadUrl={DOWNLOAD_URL}
          onDownload={() => track("download_clicked")}
          onGitHub={() => track("github_clicked")}
          onRequestCloud={(event) => openBrief(event.currentTarget)}
        />

        <section className="home-trust home-section" id="trust" aria-labelledby="trust-title">
          <header className="home-section-heading home-section-heading-compact">
            <p>Flowtake Cloud beta boundary</p>
            <h2 id="trust-title">Know what is proposed before you upload or pay.</h2>
          </header>
          <div className="home-disclosure-list">
            <details id="service-terms">
              <summary>Planned beta scope <ChevronDownIcon aria-hidden="true" /></summary>
              <div>
                <p>The planned MVP is an intentional upload of a finished H.264 MP4 to a private review link with optional passcode, 1, 7, or 30-day expiry, immediate revoke or delete, timestamp comments, and aggregate playback sessions.</p>
                <p>Proposed limits are 2 GB active storage, 10 active links, and 250 MB or 10 minutes per video. Native desktop upload, project sync, rendering, and realtime collaborative editing are planned later and are not part of this beta.</p>
              </div>
            </details>
            <details id="cancellation-policy">
              <summary>Billing, cancellation, and refunds <ChevronDownIcon aria-hidden="true" /></summary>
              <div>
                <p>$9 USD per month is a founding-beta price hypothesis, not an active offer. Checkout is unavailable, and no Cloud subscription, payment, or entitlement can be created from this site.</p>
                <p>Final recurring terms, cancellation controls, taxes, limits, and refund policy must be published and shown before any customer can purchase.</p>
              </div>
            </details>
            <details id="data-handling">
              <summary>Content, IP, and file handling <ChevronDownIcon aria-hidden="true" /></summary>
              <div>
                <p>The published desktop app does not automatically upload recordings, projects, or exports. A future Cloud upload must be an explicit user action and must reject credentials, private repositories, production access, and unsupported media.</p>
                <p>Expiry, immediate revoke, and deletion are release requirements for the planned beta. Storage location, processor, controller identity, retention behavior, and transfer details must be published before uploads are accepted.</p>
              </div>
            </details>
            <details id="privacy" open>
              <summary>Privacy and business contact <ChevronDownIcon aria-hidden="true" /></summary>
              <div>
                <p><strong>Privacy notice version {PRIVACY_NOTICE_VERSION}.</strong> This form is disabled and collects nothing. It does not submit your name, email, company, product story, video, or payment.</p>
                <p>This page sends cookie-free aggregate counts for a short allowlist of actions. The service stores only UTC day, action name, and count—not event details, page URLs, device identifiers, IP addresses, or form content. IP addresses are used only in server memory for abuse-rate limiting. No nonessential cookies are used.</p>
                <p>For privacy or business questions, contact the Flowtake project operator at <a href={`mailto:${CONTACT_EMAIL}?subject=Privacy%20request`}>{CONTACT_EMAIL}</a>. No contract, payment, or video upload is accepted before the formal controller and processing disclosure is published.</p>
                <p>Use the <a href={PUBLIC_STORYBOARD_URL} target="_blank" rel="noreferrer">public storyboard clinic</a> only for public, non-sensitive requests. Never post a private brief, credentials, customer data, or unpublished repository there.</p>
              </div>
            </details>
          </div>
          <p className="home-trust-status">
            <LockClosedIcon aria-hidden="true" /> Flowtake Cloud, uploads, and checkout are not available yet. The $9 price and beta limits are hypotheses, not an active offer.
          </p>
        </section>

        <section className="home-faq home-section" id="faq" aria-labelledby="faq-title">
          <header>
            <p>Before you install</p>
            <h2 id="faq-title">Common questions.</h2>
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
            <p>Windows 10/11 · free · MIT licensed</p>
            <h2 id="final-cta-title">Download Flowtake for Windows.</h2>
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
