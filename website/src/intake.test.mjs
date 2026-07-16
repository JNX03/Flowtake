import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  EVENT_ENDPOINT,
  INTAKE_ORIGIN,
  LEAD_ENDPOINT,
  LEAD_TIMEOUT_MS,
  LeadPayloadError,
  LeadSubmissionError,
  createLeadPayload,
  describeLeadFailure,
  sendEvent,
  submitLead,
} from "./intake.js";

test("production endpoint defaults are exact and HTTPS", () => {
  assert.equal(INTAKE_ORIGIN, "https://flowtake.72-62-41-174.sslip.io");
  assert.equal(LEAD_ENDPOINT, `${INTAKE_ORIGIN}/v1/leads`);
  assert.equal(EVENT_ENDPOINT, `${INTAKE_ORIGIN}/v1/events`);
});

test("lead payload allowlists fields, trims text, includes honeypot, and normalizes consent", () => {
  const formData = new FormData();
  formData.set("name", "  Avery Demo  ");
  formData.set("email", "  avery@example.dev ");
  formData.set("company", " Synthetic Tools ");
  formData.set("url", " https://example.dev/launch?token=discard#private ");
  formData.set("deadline", "2026-08-01");
  formData.set("story", "  Show the release workflow clearly and safely.  ");
  formData.set("privacyAccepted", "on");
  formData.set("website", "");
  formData.set("unexpected", "must-not-send");

  assert.deepEqual(createLeadPayload(formData), {
    name: "Avery Demo",
    email: "avery@example.dev",
    company: "Synthetic Tools",
    url: "https://example.dev/launch",
    deadline: "2026-08-01",
    story: "Show the release workflow clearly and safely.",
    privacyAccepted: true,
    website: "",
    source: "release-studio-website",
  });

  formData.set("url", "https://user:password@example.dev/launch");
  assert.throws(() => createLeadPayload(formData), LeadPayloadError);
});

test("events send only the allowlisted name with credential-free keepalive fetch", async () => {
  let captured;
  const response = { status: 202 };
  const result = await sendEvent("brief_opened", {
    fetchImpl: async (...args) => {
      captured = args;
      return response;
    },
  });
  assert.equal(result, response);
  assert.equal(captured[0], EVENT_ENDPOINT);
  assert.deepEqual(JSON.parse(captured[1].body), { name: "brief_opened" });
  assert.equal(captured[1].credentials, "omit");
  assert.equal(captured[1].referrerPolicy, "no-referrer");
  assert.equal(captured[1].keepalive, true);
  assert.equal(await sendEvent("not-allowlisted", { fetchImpl: async () => assert.fail() }), undefined);
  assert.equal(await sendEvent("brief_opened", { fetchImpl: async () => { throw new Error("offline"); } }), undefined);
});

test("lead submission requires an explicit 201 accepted response", async () => {
  const payload = createLeadPayload(new FormData());
  let captured;
  const accepted = await submitLead(payload, {
    fetchImpl: async (...args) => {
      captured = args;
      return { status: 201, json: async () => ({ accepted: true, id: "synthetic" }) };
    },
  });
  assert.equal(accepted.id, "synthetic");
  assert.equal(captured[0], LEAD_ENDPOINT);
  assert.deepEqual(JSON.parse(captured[1].body), payload);
  assert.equal(captured[1].credentials, "omit");
  assert.equal(captured[1].referrerPolicy, "no-referrer");

  for (const status of [400, 429, 500]) {
    await assert.rejects(
      submitLead(payload, { fetchImpl: async () => ({ status, json: async () => ({ accepted: false }) }) }),
      (error) => error instanceof LeadSubmissionError && error.status === status,
    );
  }
  await assert.rejects(
    submitLead(payload, { fetchImpl: async () => { throw new Error("offline"); } }),
    (error) => error instanceof LeadSubmissionError && error.status === 0,
  );
  await assert.rejects(
    submitLead(payload, { fetchImpl: async () => ({ status: 201, json: async () => { throw new Error("bad json"); } }) }),
    (error) => error instanceof LeadSubmissionError && error.status === 201,
  );
  await assert.rejects(
    submitLead(payload, { fetchImpl: async () => ({ status: 201, json: async () => ({ accepted: true }) }) }),
    (error) => error instanceof LeadSubmissionError && error.status === 201,
  );
});

test("lead submission aborts a stalled request within the configured deadline", async () => {
  assert.equal(LEAD_TIMEOUT_MS, 12_000);
  const payload = createLeadPayload(new FormData());
  await assert.rejects(
    submitLead(payload, {
      timeoutMs: 5,
      fetchImpl: async (_url, options) => new Promise((_resolve, reject) => {
        options.signal.addEventListener("abort", () => {
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        });
      }),
    }),
    (error) => error instanceof LeadSubmissionError && error.message === "request_timeout" && error.status === 0,
  );

  await assert.rejects(
    submitLead(payload, {
      timeoutMs: 5,
      fetchImpl: async (_url, options) => ({
        status: 201,
        json: async () => new Promise((_resolve, reject) => {
          options.signal.addEventListener("abort", () => {
            const error = new Error("aborted while reading response");
            error.name = "AbortError";
            reject(error);
          }, { once: true });
        }),
      }),
    }),
    (error) => error instanceof LeadSubmissionError && error.message === "request_timeout" && error.status === 0,
  );
});

test("only recoverable transport and rate failures expose a public or copy fallback", () => {
  assert.deepEqual(describeLeadFailure({ status: 400 }), {
    fallbackAllowed: false,
    message: "Please check the entered fields and try again.",
  });
  assert.equal(describeLeadFailure({ status: 413 }).fallbackAllowed, false);
  assert.deepEqual(describeLeadFailure({ status: 429 }), {
    fallbackAllowed: true,
    message: "Too many attempts from this network. Wait 15 minutes or use the safe options below.",
  });
  assert.deepEqual(describeLeadFailure({ status: 500 }), {
    fallbackAllowed: true,
    message: "We couldn't confirm that your brief was received. Try again or use the safe options below.",
  });
  assert.equal(describeLeadFailure({ status: 0 }).fallbackAllowed, true);
});

test("the request form exposes privacy-safe limits and explicit failure fallbacks", async () => {
  const [homeSource, dialogSource] = await Promise.all([
    readFile(new URL("./HomePage.jsx", import.meta.url), "utf8"),
    readFile(new URL("./BriefDialog.jsx", import.meta.url), "utf8"),
  ]);
  const source = `${homeSource}\n${dialogSource}`;
  for (const required of [
    'name="website"',
    'maxLength="2000"',
    "Open public clinic with a separate public-only summary",
    "Copy private brief",
    "Try again",
    "stores only UTC day, action name, and count",
    "setFallbackAllowed(failure.fallbackAllowed)",
    "error && fallbackAllowed && briefText",
    "Private request reference — do not post publicly",
    "setLeadReference(result.id)",
    "Direct email response is still being verified",
  ]) {
    assert.equal(source.includes(required), true, `missing ${required}`);
  }
  assert.equal(source.includes("Open email draft instead"), false);
  assert.equal(source.includes("expected reply time is two business days"), false);
  assert.equal(source.includes("reply with the next concrete step"), false);
  assert.equal(source.includes("sendBeacon"), false);
  assert.equal(source.includes("analytics is unconfigured"), false);

  const intakeSource = await readFile(new URL("./intake.js", import.meta.url), "utf8");
  assert.equal(intakeSource.includes("import.meta.env"), false);
  assert.equal(intakeSource.includes("Too many attempts from this network."), true);
});

test("the hero leads with the free product and keeps Release Studio secondary", async () => {
  const source = await readFile(new URL("./HomePage.jsx", import.meta.url), "utf8");
  const hero = source.slice(source.indexOf('<section className="home-hero home-section"'), source.indexOf('<section className="home-demo home-section"'));
  const downloadIndex = hero.indexOf("Download for Windows");
  const workflowIndex = hero.indexOf("See how Flowtake works");
  const productIndex = source.indexOf('<section className="home-product home-section"');
  const serviceIndex = source.indexOf("<AppAndService");

  assert.equal(hero.includes("Create polished screen demos on Windows."), true);
  assert.equal(hero.includes("cursor-driven zooms"), true);
  assert.equal(hero.includes("$99"), false);
  assert.equal(hero.includes("Four 30–90 second demos"), false);
  assert.ok(downloadIndex >= 0 && downloadIndex < workflowIndex, "free download must be the first hero CTA");
  assert.ok(productIndex >= 0 && serviceIndex > productIndex, "Release Studio must follow product proof");
  assert.equal(source.includes('onGitHub={() => track("github_clicked")}'), true);
  assert.equal(source.includes("Request a founding slot"), false);
  assert.equal(source.includes("onRequestStudio={(event) => openBrief(event.currentTarget)}"), true);
  assert.ok(
    (source.match(/track\("github_clicked"\)/gu) || []).length >= 4,
    "homepage repository and release interest must remain measurable",
  );
  assert.equal(source.includes('track("founding_cta_clicked")'), false);

  const metadata = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.equal(metadata.includes("free, open-source screen recorder and editor"), true);
  assert.equal(metadata.includes("$99/month Release Studio"), false);
});

test("the homepage proof uses three truthful product beats and no fake demo", async () => {
  const source = await readFile(new URL("./HomePage.jsx", import.meta.url), "utf8");
  const features = source.slice(source.indexOf("const productFeatures = ["), source.indexOf("const productFacts = ["));
  const proof = source.slice(source.indexOf('<section className="home-demo home-section"'), source.indexOf('<section className="home-fact-band home-section"'));

  assert.equal((features.match(/number: "0[1-3]"/gu) || []).length, 3);
  for (const required of [
    "Choose what to capture.",
    "Edit the recording.",
    "Export the finished MP4.",
  ]) {
    assert.equal(features.includes(required), true, `missing product beat: ${required}`);
  }

  for (const required of [
    "Real demo queued for isolated capture",
    "Concept frame—not product footage, customer work, or a finished video.",
    "Concept illustration—not product footage.",
    "developer-tool-demo-storyboard/",
  ]) {
    assert.equal(source.includes(required), true, `missing proof boundary: ${required}`);
  }
  assert.equal(proof.includes("productFeatures.map"), true);
  assert.equal(proof.includes("marketing/demo-theatre-background.webp"), true);
  assert.equal(features.includes("completed MP4"), false);
  assert.equal(proof.includes("<video"), false);
  assert.equal(proof.includes("<canvas"), false);
  assert.equal(source.includes("customer logo"), false);
  assert.equal(source.includes("testimonial"), false);
});

test("private outcomes stay private and the public fallback warns before linking", async () => {
  const source = await readFile(new URL("./BriefDialog.jsx", import.meta.url), "utf8");
  const outcome = source.slice(source.indexOf("{outcome ? ("), source.indexOf(") : (", source.indexOf("{outcome ? (")));
  const fallback = source.slice(source.indexOf("{error && fallbackAllowed && briefText"), source.indexOf("{status === \"sending\""));

  assert.equal(outcome.includes("PUBLIC_STORYBOARD_URL"), false);
  assert.equal(outcome.includes("Private request reference — do not post publicly"), true);
  assert.equal(fallback.includes("separate public-only summary"), true);
  assert.equal(
    fallback.indexOf("The clinic requires GitHub sign-in and is public")
      < fallback.indexOf("href={PUBLIC_STORYBOARD_URL}"),
    true,
  );
});
