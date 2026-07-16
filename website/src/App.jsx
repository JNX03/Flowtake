import {
  ArrowRightIcon,
  CheckIcon,
  ChevronDownIcon,
  CodeBracketIcon,
  CommandLineIcon,
  FilmIcon,
  FolderOpenIcon,
  LockClosedIcon,
  RectangleGroupIcon,
  VideoCameraIcon,
  WindowIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useEffect, useMemo, useRef, useState } from "react";
import { createLeadPayload, describeLeadFailure, sendEvent, submitLead } from "./intake.js";

const CONTACT_EMAIL = "jnxstartup@gmail.com";
const RELEASE_VERSION = "1.6.0";
const RELEASE_URL = `https://github.com/JNX03/Flowtake/releases/tag/v${RELEASE_VERSION}`;
const assetUrl = (name) => `${import.meta.env.BASE_URL}assets/${name}`;

const workflow = [
  {
    number: "01",
    title: "Frame the release",
    body: "Send the feature, audience, deadline, and one sentence the viewer should remember.",
    icon: FolderOpenIcon,
  },
  {
    number: "02",
    title: "Capture the real flow",
    body: "Record IDE, terminal, browser, or desktop sources separately in Flowtake so the story stays editable.",
    icon: VideoCameraIcon,
  },
  {
    number: "03",
    title: "Polish the take",
    body: "We tighten the sequence, captions, cursor treatment, scene layout, and your brand moments.",
    icon: RectangleGroupIcon,
  },
  {
    number: "04",
    title: "Approve and ship",
    body: "Review a private cut, request one focused revision, then receive the master and social cutdown.",
    icon: FilmIcon,
  },
];

const deliverables = [
  "Four 30–90 second release demos each month",
  "IDE, terminal, browser, and desktop scene cleanup",
  "Captions, cursor and keyboard styling, branded intro/outro",
  "One 16:9 master plus one social cutdown per demo",
  "Private review link and one focused revision round",
  "First cut within 3 business days of a usable brief and capture",
];

const faqs = [
  {
    question: "Is Flowtake becoming paid?",
    answer:
      "No. The published Flowtake recorder and editor remain free and MIT-licensed. Release Studio is an optional done-with-you service for teams that want finished launch assets and a faster production loop.",
  },
  {
    question: "What do we need to provide?",
    answer:
      "A short release brief, access to a safe demo environment, and either your Flowtake project or source recordings. Never include production credentials or customer data in a capture.",
  },
  {
    question: "Can you work from an existing recording?",
    answer:
      "Usually, yes. Separate source tracks give us the most control, but we can first review an existing capture and tell you what is realistically reusable before you commit.",
  },
  {
    question: "Why only founding slots?",
    answer:
      "The service is intentionally small while the workflow is proven. We would rather deliver four strong demos for a few teams than sell capacity we cannot support.",
  },
  {
    question: "How do cancellation and refunds work?",
    answer:
      "After a scope is accepted, the $99 plan renews monthly until cancelled. Cancel before the next renewal to stop future billing. Work already started is normally non-refundable; if we cannot begin or meet the agreed delivery window, we will refund that affected order. Full pilot terms are confirmed before payment.",
  },
  {
    question: "How are recordings handled?",
    answer:
      "Do not send credentials, customer data, private repositories, or production access. We will provide an approved review path before accepting footage, use files only for delivery, and delete working copies on the agreed schedule. The current VPS is not used for customer video.",
  },
];

function track(name) {
  void sendEvent(name);
}

export function App() {
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

  return (
    <div className="site-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>

      <header className="site-header" inert={briefOpen ? true : undefined} aria-hidden={briefOpen ? "true" : undefined}>
        <a className="brand" href="#top" aria-label="Flowtake Release Studio home">
          <img src={assetUrl("logo.svg")} alt="" />
          <span>Flowtake</span>
          <span className="brand-edition">Open-source demo studio</span>
        </a>

        <nav className="desktop-nav" aria-label="Primary navigation">
          <a href="#workflow">Workflow</a>
          <a href="#founding-plan">Founding plan</a>
          <a href="#open-source">Open source</a>
          <a href="#trust">Trust</a>
          <a href="#faq">FAQ</a>
        </nav>

        <div className="header-actions">
          <a
            className="text-link desktop-only"
            href="https://github.com/JNX03/Flowtake"
            target="_blank"
            rel="noreferrer"
            onClick={() => track("github_clicked")}
          >
            GitHub
          </a>
          <a
            className="button button-small"
            href="https://github.com/JNX03/Flowtake/releases/latest"
            target="_blank"
            rel="noreferrer"
            onClick={() => track("download_clicked")}
          >
            Download free
          </a>
          <button
            className="menu-button"
            type="button"
            aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={mobileOpen}
            aria-controls="mobile-navigation"
            onClick={() => setMobileOpen((value) => !value)}
          >
            {mobileOpen ? <XMarkIcon /> : <span aria-hidden="true">Menu</span>}
          </button>
        </div>

        {mobileOpen && (
          <nav className="mobile-nav" id="mobile-navigation" aria-label="Mobile navigation">
            <a href="#workflow" onClick={() => setMobileOpen(false)}>Workflow</a>
            <a href="#founding-plan" onClick={() => setMobileOpen(false)}>Founding plan</a>
            <a href="#open-source" onClick={() => setMobileOpen(false)}>Open source</a>
            <a href="#trust" onClick={() => setMobileOpen(false)}>Trust</a>
            <a href="#faq" onClick={() => setMobileOpen(false)}>FAQ</a>
            <a href="https://github.com/JNX03/Flowtake" target="_blank" rel="noreferrer">GitHub</a>
            <a href="https://github.com/JNX03/Flowtake/releases/latest" target="_blank" rel="noreferrer">Download current release</a>
          </nav>
        )}
      </header>

      <main id="main-content" inert={briefOpen ? true : undefined} aria-hidden={briefOpen ? "true" : undefined}>
        <section className="hero section" id="top">
          <div className="hero-copy">
            <p className="eyebrow">
              <span className="eyebrow-line" aria-hidden="true" />
              Free MIT recorder · optional $99/month production
            </p>
            <h1>
              Record the build.
              <span>Ship a clear <em>demo.</em></span>
            </h1>
            <p className="hero-lede">
              Capture IDE, terminal, browser, and desktop sources locally with the free app. Release Studio turns approved workflows into polished launch demos.
            </p>

            <div className="price-line">
              <span className="price">$99</span>
              <span className="price-period">/ month</span>
              <span className="price-note">Four 30–90 second demos · 16:9 masters + social cutdowns</span>
            </div>

            <div className="hero-actions">
              <button className="button button-primary" type="button" onClick={(event) => openBrief(event.currentTarget)}>
                Request a sample storyboard
                <ArrowRightIcon aria-hidden="true" />
              </button>
              <a
                className="button button-quiet"
                href="https://github.com/JNX03/Flowtake/releases/latest"
                target="_blank"
                rel="noreferrer"
                onClick={() => track("download_clicked")}
              >
                Download Flowtake free
                <ArrowRightIcon aria-hidden="true" />
              </a>
            </div>

            <p className="honest-note">
              Windows artifacts are unsigned. macOS is ad-hoc signed but not notarized; macOS and Linux remain preview builds. Review the platform notes and checksums on GitHub before installing.
            </p>
          </div>

          <div className="hero-visual" aria-label={`Flowtake v${RELEASE_VERSION} release summary`}>
            <div className="visual-meta">
              <span>Published desktop release</span>
              <span className="visual-status"><i /> Verified</span>
            </div>
            <figure className="product-frame release-frame">
              <div className="release-product">
                <img src={assetUrl("logo.png")} alt="" />
                <div className="release-product-copy">
                  <span>Free and MIT licensed</span>
                  <strong>{`Flowtake v${RELEASE_VERSION}`}</strong>
                  <p>Local recording, an editable timeline, captions, cursor treatment, and MP4 export in the published desktop app.</p>
                  <a href={RELEASE_URL} target="_blank" rel="noreferrer">
                    View release assets and checksums
                    <ArrowRightIcon aria-hidden="true" />
                  </a>
                </div>
              </div>
              <figcaption>
                <span>Exact release: July 16, 2026</span>
                <span>Checksums published</span>
              </figcaption>
            </figure>
            <div className="source-rail" aria-label="Published platform support">
              <span><WindowIcon /> Windows</span>
              <span><CodeBracketIcon /> macOS preview</span>
              <span><CommandLineIcon /> Linux preview</span>
            </div>
          </div>
        </section>

        <section className="signal-bar" aria-label="Product boundaries">
          <span><LockClosedIcon /> Local capture workflow</span>
          <span><CodeBracketIcon /> MIT recorder stays free</span>
          <span><FilmIcon /> Paid outcome: finished assets</span>
        </section>

        <section className="section workflow-section" id="workflow">
          <header className="section-heading">
            <p className="kicker">One recording. One production loop.</p>
            <h2>From release brief to approved take.</h2>
            <p>
              Keep the technical truth in the product. We shape the sequence around what a buyer needs to understand next.
            </p>
          </header>

          <ol className="workflow-list">
            {workflow.map(({ number, title, body, icon: Icon }) => (
              <li key={number}>
                <span className="workflow-number">{number}</span>
                <Icon className="workflow-icon" aria-hidden="true" />
                <div>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="section proof-section proof-section-copy-only">
          <div className="proof-copy">
            <p className="kicker">Why the capture matters</p>
            <h2>Technical demos break when every scene is flattened too early.</h2>
            <p>
              Flowtake keeps the real product flow visible while the production pass handles framing, pace, captions, cursor treatment, and handoffs.
            </p>
            <ul className="check-list">
              <li><CheckIcon /> Show the command and the result in one coherent story.</li>
              <li><CheckIcon /> Reframe a scene without asking engineering to record the whole launch again.</li>
              <li><CheckIcon /> Export a master and social cutdown from the same approved narrative.</li>
            </ul>
          </div>
        </section>

        <section className="section founding-section" id="founding-plan">
          <div className="founding-intro">
            <p className="kicker">Founding plan</p>
            <h2>Enough output to support a real release cadence.</h2>
            <p>
              Built for a small devtool team that ships often and does not need another complicated creative subscription.
            </p>
          </div>

          <div className="plan-surface">
            <div className="plan-price">
              <span>Release Studio</span>
              <strong>$99</strong>
              <small>per month · founding rate</small>
            </div>
            <ul>
              {deliverables.map((item) => (
                <li key={item}><CheckIcon aria-hidden="true" /> {item}</li>
              ))}
            </ul>
            <div className="plan-action">
              <button className="button button-primary" type="button" onClick={(event) => openBrief(event.currentTarget)}>
                Request a sample storyboard
                <ArrowRightIcon aria-hidden="true" />
              </button>
              <p>$99 recurring monthly after written scope confirmation. Cancel before renewal. Checkout stays private until timing, safe capture, and terms are accepted.</p>
            </div>
          </div>
        </section>

        <section className="section open-source-section" id="open-source">
          <div className="open-source-mark">
            <img src={assetUrl("logo.svg")} alt="" />
            <span>MIT</span>
          </div>
          <div>
            <p className="kicker">Open source, plus optional production help</p>
            <h2>The recorder is the commons. The finished release workflow is the service.</h2>
          </div>
          <div className="open-source-actions">
            <p>
              Use, inspect, fork, and improve the existing Flowtake recorder and editor. Release Studio adds hands-on production; it does not remove published features.
            </p>
            <a className="button button-quiet" href="https://github.com/JNX03/Flowtake" target="_blank" rel="noreferrer">
              View the repository <ArrowRightIcon aria-hidden="true" />
            </a>
            <a className="text-link comparison-context-link" href={`${import.meta.env.BASE_URL}screen-studio-alternative-windows/`}>
              Compare Flowtake with Screen Studio on Windows
            </a>
          </div>
        </section>

        <section className="section trust-section" id="trust">
          <header className="section-heading compact">
            <p className="kicker">Pilot terms and trust boundary</p>
            <h2>Know the scope before payment or footage.</h2>
            <p>
              Release Studio remains qualification-first. No checkout or customer-file upload opens until the workflow, delivery window, and safe review path are confirmed in writing.
            </p>
          </header>
          <div className="trust-grid">
            <article id="service-terms">
              <h3>Scope and delivery</h3>
              <p>Four 30–90 second demos per paid month, each with one 16:9 master, one social cutdown, and one consolidated revision. The first cut is due within three business days after a usable brief and sanitized capture; the revision is due within two business days.</p>
              <p>Source footage should be no more than 10 minutes per demo. Voiceover production, stock licensing, custom animation, and unused monthly capacity are excluded unless agreed separately.</p>
            </article>
            <article id="cancellation-policy">
              <h3>Billing, cancellation, and refunds</h3>
              <p>The founding pilot is $99 USD, recurring monthly only after written scope acceptance. Cancel before the next renewal to stop future billing; access continues through the paid period.</p>
              <p>Work already started is normally non-refundable. If Flowtake cannot begin or meet the agreed delivery window, the affected order is refunded. Taxes and any future price change must be shown before checkout.</p>
            </article>
            <article id="data-handling">
              <h3>Content, IP, and file handling</h3>
              <p>Never submit credentials, customer data, private repositories, or production access. Customer footage is accepted only through an approved access-controlled path—not the current VPS—and working copies are deleted within 30 days after delivery unless a shorter period is agreed.</p>
              <p>After payment, the customer owns the custom delivered master and cutdown. Flowtake retains its MIT app and pre-existing templates. Nothing enters a public portfolio without written permission.</p>
            </article>
            <article id="privacy">
              <h3>Privacy and business contact</h3>
              <p>Lead requests send your name, work email, company, optional public URL and target date, release story, and consent record to Flowtake's HTTPS intake service so we can assess and reply. Lead records are encrypted at rest and declined or inactive leads are deleted within 90 days.</p>
              <p>This page also sends cookie-free aggregate counts for a short allowlist of actions. The service stores only UTC day, action name, and count - not event details, page URLs, device identifiers, or form content. IP addresses are used in server memory for abuse-rate limiting and are not written to lead or event files. No nonessential cookies are used.</p>
              <p>Flowtake is operated from Thailand. Formal contracting identity and address will be disclosed before payment. Contact <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>; expected reply time is two business days. Thailand PDPA and customer-specific data terms will be reviewed before private footage is accepted.</p>
            </article>
          </div>
          <p className="trust-status">Effective pilot disclosure: July 16, 2026. Checkout remains disabled until the secure review path and final contracting details are verified.</p>
        </section>

        <section className="section faq-section" id="faq">
          <header className="section-heading compact">
            <p className="kicker">Questions before the first take</p>
            <h2>Clear boundaries, before you send a brief.</h2>
          </header>
          <div className="faq-list">
            {faqs.map((item) => (
              <details key={item.question}>
                <summary>
                  {item.question}
                  <ChevronDownIcon aria-hidden="true" />
                </summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="section final-cta">
          <div>
            <p className="eyebrow"><span className="eyebrow-line" aria-hidden="true" /> Cue the next release</p>
            <h2>Show us the workflow. We’ll frame the take.</h2>
          </div>
          <button className="button button-primary" type="button" onClick={(event) => openBrief(event.currentTarget)}>
            Request a sample storyboard <ArrowRightIcon aria-hidden="true" />
          </button>
        </section>
      </main>

      <footer className="site-footer" inert={briefOpen ? true : undefined} aria-hidden={briefOpen ? "true" : undefined}>
        <div className="brand footer-brand">
          <img src={assetUrl("logo.svg")} alt="" />
          <span>Flowtake</span>
        </div>
        <p>Open-source recorder. Optional release production.</p>
        <div>
          <a href="https://github.com/JNX03/Flowtake" target="_blank" rel="noreferrer">GitHub</a>
          <a href={`${import.meta.env.BASE_URL}screen-studio-alternative-windows/`}>Windows comparison</a>
          <a href="#service-terms">Terms</a>
          <a href="#privacy">Privacy</a>
          <a href="#cancellation-policy">Cancellation</a>
          <a href={`mailto:${CONTACT_EMAIL}`}>Contact</a>
        </div>
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

export function BriefDialog({ onClose, restoreFocusTo, privacyHref = "#privacy" }) {
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [briefText, setBriefText] = useState("");
  const [briefSubject, setBriefSubject] = useState("");
  const [fallbackAllowed, setFallbackAllowed] = useState(false);
  const firstInput = useRef(null);
  const dialogRef = useRef(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    firstInput.current?.focus();

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = Array.from(
        dialogRef.current?.querySelectorAll(
          'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), a[href], summary'
        ) || []
      ).filter((element) => element.getClientRects().length > 0);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      queueMicrotask(() => restoreFocusTo?.focus?.());
    };
  }, [onClose, restoreFocusTo]);

  const sendBrief = async (event) => {
    event.preventDefault();
    setError("");
    setBriefText("");
    setBriefSubject("");
    setFallbackAllowed(false);
    setStatus("sending");

    let payload;
    try {
      payload = createLeadPayload(new FormData(event.currentTarget));
    } catch (payloadError) {
      setError(payloadError.message || "Please check the entered fields and try again.");
      setStatus("idle");
      return;
    }
    const text = [
      `Name: ${payload.name}`,
      `Work email: ${payload.email}`,
      `Company: ${payload.company}`,
      `Launch URL: ${payload.url || "Not provided"}`,
      `Target date: ${payload.deadline || "Not provided"}`,
      "",
      "Release story:",
      payload.story,
    ].join("\n");
    setBriefText(text);
    setBriefSubject(`Flowtake Release Studio brief - ${payload.company}`);

    try {
      await submitLead(payload);
      track("brief_submitted");
      setStatus("submitted");
    } catch (submissionError) {
      const failure = describeLeadFailure(submissionError);
      setFallbackAllowed(failure.fallbackAllowed);
      setError(failure.message);
      setStatus("idle");
    }
  };

  const openEmailFallback = () => {
    if (!fallbackAllowed || !briefText) return;
    track("brief_handoff_started");
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(briefSubject)}&body=${encodeURIComponent(briefText)}`;
    setStatus("email");
  };

  const copyBrief = async () => {
    if (!briefText || (status === "idle" && !fallbackAllowed)) return;
    try {
      await navigator.clipboard.writeText(briefText);
      setError("");
      setStatus("copied");
      track("brief_copied");
    } catch {
      setError(`Clipboard access failed. Select the brief manually or email ${CONTACT_EMAIL}.`);
    }
  };

  const outcome = useMemo(() => {
    if (status === "submitted") {
      return {
        title: "Brief received.",
        body: "We’ll review the workflow and reply with the next concrete step. No payment was taken.",
      };
    }
    if (["email", "copied"].includes(status)) {
      return {
        title: status === "copied" ? "Brief copied." : "Email draft opened.",
        body: status === "copied"
          ? `Paste it into an email to ${CONTACT_EMAIL}. Nothing was submitted automatically.`
          : `Send the draft from your email app to complete the request. Nothing was submitted automatically.`,
      };
    }
    return null;
  }, [status]);

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section ref={dialogRef} className="brief-dialog" role="dialog" aria-modal="true" aria-labelledby="brief-title">
        <button className="dialog-close" type="button" onClick={onClose} aria-label="Close request form">
          <XMarkIcon />
        </button>

        <div className="dialog-intro">
          <p className="kicker">Sample storyboard request</p>
          <h2 id="brief-title">Give us the release in five minutes.</h2>
          <p>We’ll use this only to assess the demo story and the safest next capture.</p>
        </div>

        {outcome ? (
          <div className="dialog-outcome" role="status">
            <CheckIcon aria-hidden="true" />
            <h3>{outcome.title}</h3>
            <p>{outcome.body}</p>
            {error && <p className="form-error" role="alert">{error}</p>}
            {briefText && status !== "submitted" && (
              <button className="button button-quiet" type="button" onClick={copyBrief}>
                {status === "copied" ? "Copied" : "Copy brief instead"}
              </button>
            )}
            <button className="text-link" type="button" onClick={onClose}>Close</button>
          </div>
        ) : (
          <form onSubmit={sendBrief} onInput={() => {
            if (error) setError("");
            if (fallbackAllowed) setFallbackAllowed(false);
          }}>
            <div className="form-grid">
              <label>
                Your name <span>required</span>
                <input ref={firstInput} name="name" autoComplete="name" maxLength="80" required />
              </label>
              <label>
                Work email <span>required</span>
                <input name="email" type="email" autoComplete="email" maxLength="254" required />
              </label>
              <label>
                Company or project <span>required</span>
                <input name="company" autoComplete="organization" maxLength="100" required />
              </label>
              <label>
                Launch or product URL <span>optional</span>
                <input name="url" type="url" inputMode="url" placeholder="https://" maxLength="500" />
              </label>
            </div>
            <label>
              Target release date <span>optional</span>
              <input name="deadline" type="date" />
            </label>
            <label>
              What should a viewer understand after 45 seconds? <span>required</span>
              <textarea name="story" rows="4" minLength="20" maxLength="2000" required aria-describedby="brief-safety" />
            </label>
            <p className="form-safety" id="brief-safety">
              Do not include passwords, API keys, customer data, or access to a production environment.
            </p>
            <label className="consent-row">
              <input name="privacyAccepted" type="checkbox" required />
              <span>I've read the <a href={privacyHref} target="_blank" rel="noreferrer">privacy disclosure</a> and agree to Flowtake using this brief to assess and reply. I understand this is not a purchase.</span>
            </label>
            <div className="form-honeypot" aria-hidden="true" inert={true}>
              <label>
                Website
                <input
                  name="website"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  maxLength="500"
                  data-1p-ignore="true"
                  data-lpignore="true"
                  data-bwignore="true"
                />
              </label>
            </div>
            {error && <p className="form-error" role="alert">{error}</p>}
            {error && fallbackAllowed && briefText && (
              <div className="form-fallback-actions">
                <button className="button button-quiet" type="button" onClick={openEmailFallback}>Open email draft instead</button>
                <button className="text-link" type="button" onClick={copyBrief}>Copy brief</button>
              </div>
            )}
            <p className="form-status" aria-live="polite">{status === "sending" ? "Sending your brief..." : ""}</p>
            <button className="button button-primary form-submit" type="submit" disabled={status === "sending"}>
              {status === "sending" ? "Sending..." : error ? "Try again" : "Send the brief"}
              <ArrowRightIcon aria-hidden="true" />
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
