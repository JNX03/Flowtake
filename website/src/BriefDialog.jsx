import {
  ArrowRightIcon,
  CheckIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useEffect, useMemo, useRef, useState } from "react";
import { createLeadPayload, describeLeadFailure, sendEvent, submitLead } from "./intake.js";

const PUBLIC_STORYBOARD_URL = "https://github.com/JNX03/Flowtake/discussions/169";

function track(name) {
  void sendEvent(name);
}

export function BriefDialog({ onClose, restoreFocusTo, privacyHref = "#privacy" }) {
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [briefText, setBriefText] = useState("");
  const [leadReference, setLeadReference] = useState("");
  const [fallbackAllowed, setFallbackAllowed] = useState(false);
  const firstInput = useRef(null);
  const dialogRef = useRef(null);
  const errorRef = useRef(null);

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

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  const sendBrief = async (event) => {
    event.preventDefault();
    setError("");
    setBriefText("");
    setLeadReference("");
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

    try {
      const result = await submitLead(payload);
      setLeadReference(result.id);
      track("brief_submitted");
      setStatus("submitted");
    } catch (submissionError) {
      const failure = describeLeadFailure(submissionError);
      setFallbackAllowed(failure.fallbackAllowed);
      setError(failure.message);
      setStatus("idle");
    }
  };

  const copyBrief = async () => {
    if (!briefText || (status === "idle" && !fallbackAllowed)) return;
    try {
      await navigator.clipboard.writeText(briefText);
      setError("");
      setStatus("copied");
      track("brief_copied");
    } catch {
      setError("Clipboard access failed. Try again or use the public storyboard clinic.");
    }
  };

  const outcome = useMemo(() => {
    if (status === "submitted") {
      return {
        title: "Brief received.",
        body: "Your encrypted request is stored for review. Save the reference below; no payment was taken.",
      };
    }
    if (status === "copied") {
      return {
        title: "Private brief copied.",
        body: "Keep the copied version private. Nothing was submitted automatically.",
      };
    }
    return null;
  }, [status]);

  const errorMessage = error ? (
    <p
      ref={errorRef}
      className="form-error"
      id="brief-form-error"
      role="alert"
      tabIndex={-1}
    >
      {error}
    </p>
  ) : null;

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section
        ref={dialogRef}
        className="brief-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="brief-title"
        aria-describedby="brief-description"
      >
        <button className="dialog-close" type="button" onClick={onClose} aria-label="Close request form">
          <XMarkIcon />
        </button>

        <div className="dialog-intro">
          <p className="kicker">Sample storyboard request</p>
          <h2 id="brief-title">Give us the release in five minutes.</h2>
          <p id="brief-description">We’ll use this only to assess the demo story and the safest next capture.</p>
        </div>

        {outcome ? (
          <div className="dialog-outcome" role="status">
            <CheckIcon aria-hidden="true" />
            <h3>{outcome.title}</h3>
            <p>{outcome.body}</p>
            {leadReference && (
              <p className="lead-reference">
                <span>Private request reference — do not post publicly</span>
                <code>{leadReference}</code>
              </p>
            )}
            {errorMessage}
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
          }} aria-describedby={error ? "brief-form-error" : undefined}>
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
            {errorMessage}
            {error && fallbackAllowed && briefText && (
              <>
                <p className="form-safety">
                  The clinic requires GitHub sign-in and is public. Write a separate public-only summary with only a public project URL and workflow—never paste your email, this private brief, credentials, or customer data there.
                </p>
                <div className="form-fallback-actions">
                  <a
                    className="button button-quiet"
                    href={PUBLIC_STORYBOARD_URL}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => track("github_clicked")}
                  >
                    Open public clinic with a separate public-only summary
                  </a>
                  <button className="text-link" type="button" onClick={copyBrief}>Copy private brief</button>
                </div>
              </>
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
