import { useId } from "react";
import "./app-and-service.css";

const SOURCE_URL = "https://github.com/JNX03/Flowtake";

const desktopFeatures = [
  "Screen, window, and selected-area capture",
  "Editable timeline",
  "Zoom, cursor treatment, captions, and redaction",
  "Local, video-only AVC MP4 export",
];

const webRecorderFeatures = [
  "Explicit browser picker for a tab, window, or screen",
  "Local, video-only WebM preview and download",
  "No account, automatic upload, microphone, or audio track",
  "10-minute and 250 MiB local safety limits",
];

const proEditorFeatures = [
  "Device-local trim and real-time, video-only WebM export",
  "Manual smooth cursor path with no automatic cursor tracking",
  "Manual zoom center and strength controls",
  "Optional screen and camera composition",
];

const hostedReviewFeatures = [
  "Private links with optional passcode and explicit expiry",
  "Immediate revoke or delete controls",
  "Timestamp comments and aggregate playback sessions",
  "A separate backend gate before any hosted transfer",
];

const differences = [
  {
    label: "Product boundary",
    app: "The complete MIT desktop app stays free. The web recorder is also a $0 local workflow.",
    cloud: "Pro remains a private product review and $9/month hypothesis. It removes no desktop feature.",
  },
  {
    label: "Browser workflow",
    app: "The free web recorder captures a tab, window, or screen to a local, video-only WebM.",
    cloud: "The private Pro editor adds local trim, a manual cursor path, zoom, and video-only WebM export.",
  },
  {
    label: "Camera",
    app: "The free web recorder captures the selected screen surface without audio.",
    cloud: "The private Pro build can compose an optional camera layer before local download.",
  },
  {
    label: "Hosted review",
    app: "No account or upload is needed for either local workflow.",
    cloud: "Links, passcodes, expiry, revoke, delete, and comments remain behind a separate backend gate.",
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
        <p className="app-and-service__eyebrow">$0 local tools and a private Pro hypothesis</p>
        <h2 id={sectionTitleId}>Keep the complete desktop app. Add a browser workflow only if it helps.</h2>
        <p>
          Desktop recording and editing remain free and MIT-licensed. The web recorder is also local and free.
          Pro is a private product review for browser editing, camera composition, and a separately gated hosted layer.
        </p>
      </header>

      <div className="app-and-service__options">
        <article className="app-and-service__panel app-and-service__panel--app" aria-labelledby={appTitleId}>
          <header className="app-and-service__panel-header">
            <div>
              <p className="app-and-service__label">Free desktop and browser capture</p>
              <h3 id={appTitleId}>Flowtake Free</h3>
            </div>
            <p className="app-and-service__price" aria-label="Zero dollars for local Flowtake tools">
              <strong>$0</strong>
              <span>local tools</span>
            </p>
          </header>

          <p className="app-and-service__summary">
            The complete MIT-licensed Flowtake desktop app stays $0. Its recorder, editor, and local export are not
            removed or locked by Pro.
          </p>

          <div className="app-and-service__feature-group">
            <h4>Desktop app · published v1.6.0</h4>
            <ul className="app-and-service__feature-list">
              {desktopFeatures.map((feature) => <li key={feature}>{feature}</li>)}
            </ul>
          </div>

          <div className="app-and-service__feature-group">
            <h4>Web recorder · private review build</h4>
            <ul className="app-and-service__feature-list">
              {webRecorderFeatures.map((feature) => <li key={feature}>{feature}</li>)}
            </ul>
          </div>

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

        <p className="app-and-service__mobile-divider"><span>What Pro would add</span></p>

        <article className="app-and-service__panel app-and-service__panel--service" aria-labelledby={serviceTitleId}>
          <header className="app-and-service__panel-header">
            <div>
              <p className="app-and-service__label">Private product review · no checkout</p>
              <h3 id={serviceTitleId}>Flowtake Pro</h3>
            </div>
            <p className="app-and-service__price" aria-label="Nine dollars per month price hypothesis">
              <strong>$9</strong>
              <span>/ month hypothesis</span>
            </p>
          </header>

          <p className="app-and-service__summary">
            Pro is a private product-review hypothesis. The current review build adds a device-local browser editor
            and optional camera composition; it creates no entitlement and starts no billing.
          </p>

          <div className="app-and-service__feature-group">
            <h4>Device-local Pro editor</h4>
            <ul className="app-and-service__feature-list app-and-service__feature-list--service">
              {proEditorFeatures.map((feature) => <li key={feature}>{feature}</li>)}
            </ul>
          </div>

          <div className="app-and-service__feature-group">
            <h4>Hosted review · separate backend gate</h4>
            <ul className="app-and-service__feature-list app-and-service__feature-list--service">
              {hostedReviewFeatures.map((feature) => <li key={feature}>{feature}</li>)}
            </ul>
          </div>

          <p className="app-and-service__boundary">
            <strong>Review boundary:</strong> nothing on this site creates a Pro entitlement, starts billing, uploads
            a file, or opens a hosted review link. Proposed hosted limits remain 2 GB active storage, 10 active links,
            and 250 MB or 10 minutes per video.
          </p>

          <button className="app-and-service__button app-and-service__button--secondary" type="button" onClick={onRequestCloud}>
            Review proposed Pro scope
          </button>
        </article>
      </div>

      <div className="app-and-service__difference" aria-label="What the Flowtake Pro hypothesis would add">
        <header>
          <h3>What the $9 hypothesis would add</h3>
          <p>The local desktop app stays complete. Pro adds an optional browser workflow; hosted review remains gated.</p>
        </header>
        <div className="app-and-service__difference-head" aria-hidden="true">
          <span />
          <strong>Free local tools</strong>
          <strong>Pro private review</strong>
        </div>
        <dl>
          {differences.map((difference) => (
            <div key={difference.label}>
              <dt>{difference.label}</dt>
              <dd data-label="Free local tools">
                <span className="app-and-service__sr-only">Free local tools: </span>
                {difference.app}
              </dd>
              <dd data-label="Pro private review">
                <span className="app-and-service__sr-only">Pro private review: </span>
                {difference.cloud}
              </dd>
            </div>
          ))}
        </dl>
      </div>

    </section>
  );
}
