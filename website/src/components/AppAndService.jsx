import { useId } from "react";
import "./app-and-service.css";

const SOURCE_URL = "https://github.com/JNX03/Flowtake";

const appFeatures = [
  "Screen, window, and selected-area capture",
  "Editable timeline",
  "Zoom, cursor treatment, captions, and redaction",
  "Local MP4 export",
];

const cloudFeatures = [
  "Private review links for uploaded H.264 MP4 exports",
  "Optional passcode plus 1, 7, or 30-day expiry",
  "Revoke or delete an active link at any time",
  "Timestamp comments and aggregate playback sessions",
];

const differences = [
  {
    label: "Software access",
    app: "The complete MIT-licensed app",
    cloud: "A separate hosted review layer; no local app features are removed",
  },
  {
    label: "Where work happens",
    app: "You record, edit, and export",
    cloud: "You intentionally upload a finished H.264 MP4 for private review",
  },
  {
    label: "Sharing",
    app: "Files and projects remain on your device",
    cloud: "Private links with passcode, expiry, revoke, and delete controls",
  },
  {
    label: "Feedback",
    app: "No hosted review account is required",
    cloud: "Timestamp comments and aggregate playback sessions, not identified viewer counts",
  },
];

export function AppAndService({
  comparisonUrl,
  downloadUrl,
  id = "open-source-vs-cloud",
  onDownload,
  onGitHub,
  onRequestCloud,
}) {
  const sectionTitleId = useId();
  const appTitleId = useId();
  const serviceTitleId = useId();

  return (
    <section className="app-and-service" id={id} aria-labelledby={sectionTitleId}>
      <header className="app-and-service__intro">
        <p className="app-and-service__eyebrow">Free local app and optional hosted sharing</p>
        <h2 id={sectionTitleId}>Edit locally. Share a finished video when you choose.</h2>
        <p>Flowtake Cloud is a planned hosted review layer. It does not change or paywall the local app.</p>
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
            a Flowtake Cloud subscription.
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

        <p className="app-and-service__mobile-divider"><span>Need private sharing?</span></p>

        <article className="app-and-service__panel app-and-service__panel--service" aria-labelledby={serviceTitleId}>
          <header className="app-and-service__panel-header">
            <div>
              <p className="app-and-service__label">Planned hosted software beta</p>
              <h3 id={serviceTitleId}>Flowtake Cloud</h3>
            </div>
            <p className="app-and-service__price" aria-label="Proposed nine dollars per month founding beta price">
              <strong>$9</strong>
              <span>/ month hypothesis</span>
            </p>
          </header>

          <p className="app-and-service__summary">
            The planned founding beta adds private review links for finished videos. Enrollment, billing, and uploads
            are not open yet.
          </p>

          <ul className="app-and-service__feature-list app-and-service__feature-list--service">
            {cloudFeatures.map((feature) => <li key={feature}>{feature}</li>)}
          </ul>

          <p className="app-and-service__boundary">
            <strong>Proposed beta limits:</strong> 2 GB active storage, 10 active links, 250 MB and 10 minutes per
            video, with at most 30-day expiry. Native desktop upload and realtime collaborative editing are planned,
            not included in this beta.
          </p>

          <button className="app-and-service__button app-and-service__button--secondary" type="button" onClick={onRequestCloud}>
            Check beta access
          </button>
        </article>
      </div>

      <div className="app-and-service__difference" aria-label="What changes when you add Flowtake Cloud">
        <header>
          <h3>What the planned Cloud beta adds</h3>
          <p>The local app stays complete. Only the optional hosted review workflow changes.</p>
        </header>
        <div className="app-and-service__difference-head" aria-hidden="true">
          <span />
          <strong>Flowtake app</strong>
          <strong>With Flowtake Cloud</strong>
        </div>
        <dl>
          {differences.map((difference) => (
            <div key={difference.label}>
              <dt>{difference.label}</dt>
              <dd data-label="Flowtake app">
                <span className="app-and-service__sr-only">Flowtake app: </span>
                {difference.app}
              </dd>
              <dd data-label="With Flowtake Cloud">
                <span className="app-and-service__sr-only">With Flowtake Cloud: </span>
                {difference.cloud}
              </dd>
            </div>
          ))}
        </dl>
      </div>

    </section>
  );
}
