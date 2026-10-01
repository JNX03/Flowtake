import assert from "node:assert/strict";
import test from "node:test";
import { CAMPAIGN, campaignProgress, captureMetrics } from "../scripts/promotion-metrics.mjs";

test("the campaign targets 100 total stars by November 1 in Bangkok time", () => {
  const baseline = campaignProgress(7, CAMPAIGN.start);
  assert.deepEqual(baseline, { stars: 7, netNewStars: 0, remainingStars: 93, daysRemaining: 31, requiredStarsPerDay: 3, status: "in-progress" });
  assert.equal(campaignProgress(6, CAMPAIGN.start).netNewStars, -1);
  assert.equal(campaignProgress(99, "2026-10-31T23:59:00+07:00").daysRemaining, 1);
  const late = campaignProgress(99, CAMPAIGN.deadline);
  assert.equal(late.daysRemaining, 0);
  assert.equal(late.requiredStarsPerDay, null);
  assert.equal(late.status, "deadline-passed");
  assert.equal(campaignProgress(101, CAMPAIGN.deadline).status, "target-reached");
  assert.equal(campaignProgress(101, CAMPAIGN.start).requiredStarsPerDay, 0);
  for (const invalid of [-1, 1.5, "7", NaN]) assert.throws(() => campaignProgress(invalid));
  assert.throws(() => campaignProgress(7, "invalid"));
});

test("metrics retain unavailable traffic as unknown and do not hide repository errors", async () => {
  const calls = [];
  const snapshot = await captureMetrics({ now: CAMPAIGN.start, api: async (path) => {
    calls.push(path);
    if (path.endsWith("/traffic/views")) return { count: 87, uniques: 40, views: [{ timestamp: "2026-09-30T00:00:00Z", count: 4, uniques: 4 }] };
    if (path.endsWith("/traffic/clones")) throw new Error("token-secret-must-not-be-exposed");
    return { stargazers_count: 7, forks_count: 2 };
  } });
  assert.equal(calls.length, 3);
  assert.equal(snapshot.views.uniques, 40);
  assert.equal(snapshot.clones.available, false);
  assert.equal("count" in snapshot.clones, false);
  assert.equal(JSON.stringify(snapshot).includes("token-secret"), false);
  assert.match(snapshot.trafficWindow, /rolling 14-day/u);
  await assert.rejects(captureMetrics({ api: async () => { throw new Error("repository unavailable"); } }), /repository unavailable/u);
});
