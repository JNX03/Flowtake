import {
  shouldShowDemoRecordingSlotForLocation,
} from "../demoReviewSlot.js";
import { hasReviewedDemoMedia } from "../reviewedDemoMedia.js";
import "./demo-recording-slot.css";

const RECORDING_FILENAME = "flowtake-demo-source.mp4";

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
          <p>Local capture review · Windows 10/11</p>
          <h2 id="demo-recording-slot-title">Record the genuine Flowtake workflow.</h2>
          <span>
            Save the untouched OBS Window Capture as
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
      </div>
    </aside>
  );
}
