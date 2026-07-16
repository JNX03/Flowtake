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

const LEAD_ENDPOINT = import.meta.env.VITE_LEAD_ENDPOINT?.trim() || "";
const EVENT_ENDPOINT = import.meta.env.VITE_EVENT_ENDPOINT?.trim() || "";
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

function track(name, detail = {}) {
  if (!EVENT_ENDPOINT) return;
  const payload = JSON.stringify({
    name,
    detail,
    path: window.location.pathname,
    timestamp: new Date().toISOString(),
  });

  if (navigator.sendBeacon) {
    navigator.sendBeacon(EVENT_ENDPOINT, new Blob([payload], { type: "application/json" }));
    return;
  }

  fetch(EVENT_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => {});
}

export function App() {
  const [briefOpen, setBriefOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const briefTriggerRef = useRef(null);

  const openBrief = (source, trigger) => {
    track("brief_opened", { source });
    briefTriggerRef.current = trigger instanceof HTMLElement ? trigger : document.activeElement;
    setMobileOpen(false);
    setBriefOpen(true);
  };

  const reserve = (source, trigger) => {
    track("founding_cta_clicked", { source, checkoutMode: "qualification_first" });
    openBrief(source, trigger);
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
            onClick={() => track("github_clicked", { source: "header" })}
          >
            GitHub
          </a>
          <a
            className="button button-small"
            href="https://github.com/JNX03/Flowtake/releases/latest"
            target="_blank"
            rel="noreferrer"
            onClick={() => track("download_clicked", { source: "header" })}
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
              Free MIT desktop app · optional production help
            </p>
            <h1>
              Record the build.
              <span>Ship a clear <em>demo.</em></span>
            </h1>
            <p className="hero-lede">
              Capture IDE, terminal, browser, and desktop sources locally, then shape the real workflow into a polished developer-product story.
            </p>

            <div className="hero-actions">
              <a
                className="button button-primary"
                href="https://github.com/JNX03/Flowtake/releases/latest"
                target="_blank"
                rel="noreferrer"
                onClick={() => track("download_clicked", { source: "hero" })}
              >
                Download Flowtake free
                <ArrowRightIcon aria-hidden="true" />
              </a>
              <a className="button button-quiet" href="#founding-plan">See Release Studio</a>
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
              <button className="button button-primary" type="button" onClick={(event) => reserve("plan", event.currentTarget)}>
                Request a founding slot
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
              <p>The request form uses name, work email, company, optional URL/date, and release story only to assess and reply to the request. Declined or inactive lead data is deleted within 90 days. No nonessential cookies are used while analytics is unconfigured.</p>
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
          <button className="button button-primary" type="button" onClick={(event) => openBrief("footer", event.currentTarget)}>
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

function BriefDialog({ onClose, restoreFocusTo }) {
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [briefText, setBriefText] = useState("");
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
      restoreFocusTo?.focus?.();
    };
  }, [onClose, restoreFocusTo]);

  const sendBrief = async (event) => {
    event.preventDefault();
    setError("");
    setStatus("sending");

    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    const text = [
      `Name: ${data.name}`,
      `Work email: ${data.email}`,
      `Company: ${data.company}`,
      `Launch URL: ${data.url || "Not provided"}`,
      `Target date: ${data.deadline || "Not provided"}`,
      "",
      "Release story:",
      data.story,
    ].join("\n");
    setBriefText(text);

    try {
      if (LEAD_ENDPOINT) {
        const response = await fetch(LEAD_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...data, source: "release-studio-website" }),
        });
        if (!response.ok) throw new Error("The brief endpoint did not accept the request.");
        track("brief_submitted", { method: "endpoint" });
        setStatus("submitted");
        return;
      }

      const subject = encodeURIComponent(`Flowtake Release Studio brief · ${data.company}`);
      const body = encodeURIComponent(text);
      track("brief_handoff_started", { method: "email" });
      window.location.href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
      setStatus("email");
    } catch (submissionError) {
      setError(submissionError.message || "We could not send the brief. Please copy it and email us directly.");
      setStatus("idle");
    }
  };

  const copyBrief = async () => {
    if (!briefText) return;
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
          <form onSubmit={sendBrief}>
            <div className="form-grid">
              <label>
                Your name <span>required</span>
                <input ref={firstInput} name="name" autoComplete="name" required />
              </label>
              <label>
                Work email <span>required</span>
                <input name="email" type="email" autoComplete="email" required />
              </label>
              <label>
                Company or project <span>required</span>
                <input name="company" autoComplete="organization" required />
              </label>
              <label>
                Launch or product URL <span>optional</span>
                <input name="url" type="url" inputMode="url" placeholder="https://" />
              </label>
            </div>
            <label>
              Target release date <span>optional</span>
              <input name="deadline" type="date" />
            </label>
            <label>
              What should a viewer understand after 45 seconds? <span>required</span>
              <textarea name="story" rows="4" minLength="20" required aria-describedby="brief-safety" />
            </label>
            <p className="form-safety" id="brief-safety">
              Do not include passwords, API keys, customer data, or access to a production environment.
            </p>
            <label className="consent-row">
              <input name="privacyAccepted" type="checkbox" required />
              <span>I agree to the <a href="#privacy" target="_blank" rel="noreferrer">privacy disclosure</a> and understand this is a qualification request, not a purchase.</span>
            </label>
            {error && <p className="form-error" role="alert">{error}</p>}
            <p className="form-status" aria-live="polite">{status === "sending" ? "Preparing your request…" : ""}</p>
            <button className="button button-primary form-submit" type="submit" disabled={status === "sending"}>
              {status === "sending" ? "Preparing…" : LEAD_ENDPOINT ? "Send the brief" : "Open email draft"}
              <ArrowRightIcon aria-hidden="true" />
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
