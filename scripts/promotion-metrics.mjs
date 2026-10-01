import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

export const CAMPAIGN = Object.freeze({
  repository: "JNX03/Flowtake",
  baselineStars: 7,
  targetStars: 100,
  start: "2026-10-01T00:00:00+07:00",
  deadline: "2026-11-01T00:00:00+07:00",
});

export function campaignProgress(stars, now = new Date()) {
  assert.ok(Number.isSafeInteger(stars) && stars >= 0, "stars must be a nonnegative integer");
  const time = new Date(now).getTime();
  assert.ok(Number.isFinite(time), "capture time must be a valid date");
  const daysRemaining = Math.max(0, Math.ceil((Date.parse(CAMPAIGN.deadline) - time) / 86_400_000));
  const remainingStars = Math.max(0, CAMPAIGN.targetStars - stars);
  return {
    stars,
    netNewStars: stars - CAMPAIGN.baselineStars,
    remainingStars,
    daysRemaining,
    requiredStarsPerDay: remainingStars === 0 ? 0 : daysRemaining === 0 ? null : Number((remainingStars / daysRemaining).toFixed(2)),
    status: remainingStars === 0 ? "target-reached" : daysRemaining === 0 ? "deadline-passed" : "in-progress",
  };
}

const exec = promisify(execFile);
async function github(path) {
  const { stdout } = await exec("gh", ["api", path], { maxBuffer: 2 * 1024 * 1024 });
  return JSON.parse(stdout);
}

export async function captureMetrics({ api = github, now = new Date() } = {}) {
  const root = `repos/${CAMPAIGN.repository}`;
  const repository = await api(root);
  const traffic = await Promise.allSettled([
    api(`${root}/traffic/views`),
    api(`${root}/traffic/clones`),
  ]);
  const summary = (result) => result.status === "fulfilled"
    ? { available: true, count: result.value.count, uniques: result.value.uniques, days: result.value.views ?? result.value.clones }
    : { available: false, reason: "GitHub traffic access unavailable; sign in with repository traffic permission." };
  return {
    capturedAt: new Date(now).toISOString(),
    campaign: CAMPAIGN,
    progress: campaignProgress(repository.stargazers_count, now),
    forks: repository.forks_count,
    trafficWindow: "GitHub's rolling 14-day window; daily unique counts are not monthly unique visitors.",
    views: summary(traffic[0]),
    clones: summary(traffic[1]),
    attribution: "GitHub does not expose which post caused a star. Treat post dates and traffic changes as observations, not conversion attribution.",
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    assert.ok(process.argv.length <= 3, "usage: node scripts/promotion-metrics.mjs [OUTPUT_JSON]");
    const snapshot = await captureMetrics();
    const output = `${JSON.stringify(snapshot, null, 2)}\n`;
    if (process.argv[2]) {
      const outputPath = resolve(process.argv[2]);
      await mkdir(dirname(outputPath), { recursive: true });
      await writeFile(outputPath, output, { mode: 0o600 });
      process.stdout.write(`Saved campaign metrics to ${outputPath}\n`);
    }
    process.stdout.write(output);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
