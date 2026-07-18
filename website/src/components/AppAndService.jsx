import { useId } from "react";
import "./app-and-service.css";

const SOURCE_URL = "https://github.com/JNX03/Flowtake";

const appFeatures = [
  "Screen, window, and selected-area capture",
  "Editable timeline",
  "Zoom, cursor treatment, captions, and redaction",
  "Local MP4 export",
];

const studioDeliverables = [
  "4 short demo packages each paid month",
  "A 16:9 master + social cutdown for each demo",
  "Human editing for pacing, captions, cursor treatment, and cleanup",
  "Private review + one focused revision",
];

const differences = [
  {
    label: "Software access",
    app: "The complete MIT-licensed app",
    studio: "The same app; no exclusive features",
  },
  {
    label: "Who edits",
    app: "You record, edit, and export",
    studio: "A human editor works from your approved brief and sanitized capture",
  },
  {
    label: "Finished assets",
    app: "Whatever you create and export locally",
    studio: "4 demo packages, each with a 16:9 master and social cutdown",
  },
  {
    label: "Review and timing",
    app: "Self-serve, on your schedule",
    studio: "Private review, one focused revision, and a first cut within 3 business days after usable inputs",
  },
];

export function AppAndService({
  comparisonUrl,
  downloadUrl,
  id = "open-source-vs-studio",
  onDownload,
  onGitHub,
  onRequestStudio,
}) {
  const sectionTitleId = useId();
  const appTitleId = useId();
  const serviceTitleId = useId();

  return (
    <section className="app-and-service" id={id} aria-labelledby={sectionTitleId}>
      <header className="app-and-service__intro">
        <p className="app-and-service__eyebrow">Open-source software and optional editing help</p>
        <h2 id={sectionTitleId}>Use Flowtake yourself, or hire an editor.</h2>
        <p>Release Studio covers human editing and delivery. It does not change the software.</p>
      </header>

      <div className="app-and-service__options">
        <article className="app-and-service__panel app-and-service__panel--app" aria-labelledby={appTitleId}>
          <header className="app-and-service__panel-header">
            <div>
              <p className="app-and-service__label">Open-source desktop app</p>
              <h3 id={appTitleId}>Flowtake</h3>
            </div>
            <p className="app-and-service__price" aria-label="Zero dollars for the app">
              <strong>$0</strong>
              <span>for the app</span>
            </p>
          </header>

          <p className="app-and-service__summary">
            The full MIT-licensed Flowtake app is $0. Its recorder, editor, and local export stay available without
            buying Release Studio.
          </p>

          <ul className="app-and-service__feature-list">
            {appFeatures.map((feature) => <li key={feature}>{feature}</li>)}
          </ul>

          <div className="app-and-service__actions">
            <a
              className="app-and-service__button app-and-service__button--primary"
              href={downloadUrl}
              target="_blank"
              rel="noreferrer"
              onClick={onDownload}
            >
              Download Flowtake free
            </a>
            <a
              className="app-and-service__source-link"
              href={SOURCE_URL}
              target="_blank"
              rel="noreferrer"
              onClick={onGitHub}
            >
              View the source on GitHub
            </a>
            {comparisonUrl && (
              <a className="app-and-service__source-link" href={comparisonUrl}>
                Compare Windows recording workflows
              </a>
            )}
          </div>
        </article>

        <p className="app-and-service__mobile-divider"><span>Need an editor too?</span></p>

        <article className="app-and-service__panel app-and-service__panel--service" aria-labelledby={serviceTitleId}>
          <header className="app-and-service__panel-header">
            <div>
              <p className="app-and-service__label">Optional human production service</p>
              <h3 id={serviceTitleId}>Release Studio</h3>
            </div>
            <p className="app-and-service__price" aria-label="Ninety-nine dollars per month at the founding pilot rate">
              <strong>$99</strong>
              <span>/ month, founding pilot</span>
            </p>
          </header>

          <p className="app-and-service__summary">
            Release Studio is an optional human production service at $99/month during the founding pilot.
          </p>

          <ul className="app-and-service__feature-list app-and-service__feature-list--service">
            {studioDeliverables.map((deliverable) => <li key={deliverable}>{deliverable}</li>)}
          </ul>

          <p className="app-and-service__boundary">
            <strong>Separate from the app.</strong> Release Studio unlocks no Flowtake app features. It pays for
            human production work only.
          </p>

          <button className="app-and-service__button app-and-service__button--secondary" type="button" onClick={onRequestStudio}>
            Request a sample storyboard
          </button>
        </article>
      </div>

      <div className="app-and-service__difference" aria-label="What changes when you add Release Studio">
        <header>
          <h3>What you get when you add Studio</h3>
          <p>The software stays the same. The work and deliverables change.</p>
        </header>
        <div className="app-and-service__difference-head" aria-hidden="true">
          <span />
          <strong>Flowtake app</strong>
          <strong>With Release Studio</strong>
        </div>
        <dl>
          {differences.map((difference) => (
            <div key={difference.label}>
              <dt>{difference.label}</dt>
              <dd data-label="Flowtake app">
                <span className="app-and-service__sr-only">Flowtake app: </span>
                {difference.app}
              </dd>
              <dd data-label="With Release Studio">
                <span className="app-and-service__sr-only">With Release Studio: </span>
                {difference.studio}
              </dd>
            </div>
          ))}
        </dl>
      </div>

    </section>
  );
}
