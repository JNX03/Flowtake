import {
  shouldShowDemoRecordingSlotForLocation,
} from "../demoReviewSlot.js";
import { hasReviewedDemoMedia } from "../reviewedDemoMedia.js";
import "./demo-recording-slot.css";

const RECORDING_FILENAME = "flowtake-demo-source.mp4";
const PUBLIC_DEMO_FILENAME = "product-media/public/flowtake-v1.6.0-demo.mp4";

const RECORDING_STEPS = [
  {
    step: "1. Prepare",
    window: "Flowtake",
    action: "Show the Windows capture setup and confirm the approved window source.",
  },
  {
    step: "2. Record",
    window: "Recording - Flowtake",
    action: "Record the sanitized terminal workflow without pausing the raw source.",
  },
  {
    step: "3. Save",
    window: "Flowtake",
    action: "Stop, save, wait honestly, and open the genuine recording in the editor.",
  },
  {
    step: "4. Edit",
    window: "Flowtake",
    action: "Add a cursor zoom and trim the timeline.",
  },
  {
    step: "5. Export",
    window: "Export - Flowtake",
    action: "Export the local MP4, keep the real render wait, then show Completed and Folder or Play.",
  },
  {
    step: "6. Verify",
    window: "Clean browser",
    action: "Hold the public Flowtake release page for at least six seconds.",
  },
];

const FINAL_DEMO_SHOTS = [
  {
    timing: "0–3 seconds",
    action: "Show the real Flowtake recorder ready on the approved Windows source.",
    proof: "Flowtake shell and selected source are readable.",
  },
  {
    timing: "3–10 seconds",
    action: "Start recording and run the sanitized terminal workflow.",
    proof: "The real recording state stays visible.",
  },
  {
    timing: "10–18 seconds",
    action: "Stop, save, and open the genuine recording in the editor.",
    proof: "The saved take appears on the real timeline.",
  },
  {
    timing: "18–28 seconds",
    action: "Trim the take and add one cursor zoom.",
    proof: "The timeline, preview, and edited motion respond.",
  },
  {
    timing: "28–36 seconds",
    action: "Export the local MP4 and show the Completed state.",
    proof: "The real export status reaches Completed.",
  },
  {
    timing: "36–42 seconds",
    action: "Use Folder or Play for local-file proof, then hold the public release page.",
    proof: "The exported file and published release are both visible.",
  },
];

export function DemoRecordingSlot({
  fallback = null,
  hasReviewedMedia = hasReviewedDemoMedia,
  locationLike = globalThis.location,
} = {}) {
  const isVisible = shouldShowDemoRecordingSlotForLocation(
    locationLike,
    hasReviewedMedia,
  );

  if (!isVisible) return fallback;

  return (
    <aside
      className="demo-recording-slot"
      id="demo-recording-slot"
      aria-labelledby="demo-recording-slot-title"
    >
      <div className="demo-recording-slot__frame">
        <div className="demo-recording-slot__frame-copy">
          <p>Exact above-the-fold demo slot · Windows 10/11</p>
          <h2 id="demo-recording-slot-title">The approved 42-second demo will replace this frame.</h2>
          <span>
            This exact 16:9 position will load
            {" "}
            <code>{PUBLIC_DEMO_FILENAME}</code>
            {" "}
            only after the genuine media gate passes. Save the untouched OBS Window Capture as
            {" "}
            <code>{RECORDING_FILENAME}</code>
          </span>
        </div>
      </div>

      <div className="demo-recording-slot__instructions">
        <p>
          Use a separate non-admin <strong>FlowtakeDemo</strong> session,
          1920×1080 at 30 fps, H.264 MP4, and no audio. Use OBS Window Capture
          only. Record one uninterrupted raw source up to five minutes long and
          keep honest save and render waits. Do not pause to target the final duration.
        </p>
        <ol aria-label="Uninterrupted Windows source capture sequence">
          {RECORDING_STEPS.map((step) => (
            <li key={step.step}>
              <span>{step.step}</span>
              <strong>{step.window}</strong>
              <p>{step.action}</p>
            </li>
          ))}
        </ol>
        <p className="demo-recording-slot__privacy">
          Stop immediately for SmartScreen, permission, or administrator prompts;
          a black, stale, frozen, or wrong window; any need to fall back to Display
          Capture; or any visible account, notification, credential, customer data,
          private file, or unexpected personal content. Use synthetic or public content only.
        </p>
        <p className="demo-recording-slot__privacy">
          After the raw source passes privacy and truth review, Codex will remove
          honest waits and cut the separate exact 42-second master. The raw source
          itself should not be edited to 42 seconds.
        </p>
        <section className="demo-recording-slot__approved-cut" aria-labelledby="approved-demo-shot-list">
          <header>
            <p>Approved-demo edit map</p>
            <h3 id="approved-demo-shot-list">Six shots for the final 42-second cut.</h3>
            <span>
              These timings describe the later reviewed edit, not the uninterrupted
              raw OBS source above.
            </span>
          </header>
          <ol aria-label="Final reviewed demo shot list">
            {FINAL_DEMO_SHOTS.map((shot) => (
              <li key={shot.timing}>
                <span>{shot.timing}</span>
                <strong>{shot.action}</strong>
                <p>{shot.proof}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </aside>
  );
}
