export const INTAKE_ORIGIN = "https://flowtake.72-62-41-174.sslip.io";
export const LEAD_ENDPOINT = "https://flowtake.72-62-41-174.sslip.io/v1/leads";
export const EVENT_ENDPOINT = "https://flowtake.72-62-41-174.sslip.io/v1/events";
export const LEAD_TIMEOUT_MS = 12_000;

const EVENT_NAMES = new Set([
  "page_viewed",
  "brief_opened",
  "founding_cta_clicked",
  "github_clicked",
  "download_clicked",
  "brief_submitted",
  "brief_copied",
]);

export class LeadSubmissionError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = "LeadSubmissionError";
    this.status = status;
  }
}

export class LeadPayloadError extends Error {
  constructor(message) {
    super(message);
    this.name = "LeadPayloadError";
  }
}

export function describeLeadFailure(error) {
  if (error?.status === 400 || error?.status === 413) {
    return { fallbackAllowed: false, message: "Please check the entered fields and try again." };
  }
  if (error?.status === 429) {
    return {
      fallbackAllowed: true,
      message: "Too many attempts from this network. Wait 15 minutes or use the safe options below.",
    };
  }
  return {
    fallbackAllowed: true,
    message: "We couldn't confirm that your brief was received. Try again or use the safe options below.",
  };
}

function normalizePublicUrl(value) {
  const raw = value.trim();
  if (!raw) return "";
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new LeadPayloadError("Enter a valid public http or https URL.");
  }
  if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new LeadPayloadError("Use a public http or https URL without a username or password. Query parameters and fragments are removed.");
  }
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString();
}

export function createLeadPayload(formData) {
  const value = (name) => String(formData.get(name) ?? "");
  return {
    name: value("name").trim(),
    email: value("email").trim(),
    company: value("company").trim(),
    url: normalizePublicUrl(value("url")),
    deadline: value("deadline"),
    story: value("story").trim(),
    privacyAccepted: value("privacyAccepted") === "on",
    website: value("website"),
    source: "release-studio-website",
  };
}

export async function sendEvent(name, { endpoint = EVENT_ENDPOINT, fetchImpl = fetch } = {}) {
  if (!endpoint || !EVENT_NAMES.has(name)) return undefined;
  try {
    return await fetchImpl(endpoint, {
      method: "POST",
      mode: "cors",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
      keepalive: true,
    });
  } catch {
    return undefined;
  }
}

export async function submitLead(
  payload,
  { endpoint = LEAD_ENDPOINT, fetchImpl = fetch, timeoutMs = LEAD_TIMEOUT_MS } = {},
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let response;
    try {
      response = await fetchImpl(endpoint, {
        method: "POST",
        mode: "cors",
        credentials: "omit",
        referrerPolicy: "no-referrer",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: true,
        signal: controller.signal,
      });
    } catch (error) {
      throw new LeadSubmissionError(
        error?.name === "AbortError" || controller.signal.aborted ? "request_timeout" : "network_error",
      );
    }

    let result = null;
    try {
      result = await response.json();
    } catch (error) {
      if (error?.name === "AbortError" || controller.signal.aborted) {
        throw new LeadSubmissionError("request_timeout");
      }
      // A malformed success response must never be shown as received.
    }
    if (
      response.status !== 201
      || result?.accepted !== true
      || typeof result.id !== "string"
      || result.id.trim() === ""
    ) {
      throw new LeadSubmissionError("request_not_accepted", response.status);
    }
    return result;
  } finally {
    clearTimeout(timeout);
  }
}
