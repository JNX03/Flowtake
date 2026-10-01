import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { verifySiteRelease } from "../scripts/verify-site-release.mjs";

test("Pages accepts later main commits but rejects an unrelated or future release", async () => {
  const repositoryPath = await mkdtemp(join(tmpdir(), "flowtake-site-release-"));
  const git = (...args) => execFileSync("git", args, { cwd: repositoryPath, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  try {
    git("init");
    git("config", "user.name", "Release test");
    git("config", "user.email", "release-test@example.invalid");
    git("commit", "--allow-empty", "-m", "feat(release): fixture");
    const releaseCommit = git("rev-parse", "HEAD");
    git("tag", "v1.7.2");
    git("commit", "--allow-empty", "-m", "docs(site): fixture");
    const siteCommit = git("rev-parse", "HEAD");
    const release = { tag_name: "v1.7.2", draft: false, prerelease: false, assets: [{ name: "SHA256SUMS.txt", size: 10 }] };
    const check = (deploymentCommit = siteCommit, response = release) => verifySiteRelease({ release: response, version: "1.7.2", deploymentCommit, repositoryPath });
    assert.equal(check().releaseCommit, releaseCommit);
    assert.equal(check(releaseCommit).siteCommit, releaseCommit);
    for (const response of [
      { ...release, tag_name: "v1.7.1" },
      { ...release, draft: true },
      { ...release, prerelease: true },
      { ...release, assets: [] },
      { ...release, assets: [{ name: "SHA256SUMS.txt", size: 0 }] },
    ]) assert.throws(() => check(siteCommit, response));
    git("tag", "-f", "v1.7.2", siteCommit);
    assert.throws(() => check(releaseCommit), /must be an ancestor/u);
    git("checkout", "--orphan", "unrelated");
    git("commit", "--allow-empty", "-m", "feat(release): unrelated fixture");
    git("tag", "-f", "v1.7.2");
    assert.throws(() => check(siteCommit), /must be an ancestor/u);
    git("tag", "-d", "v1.7.2");
    assert.throws(() => check());
  } finally {
    await rm(repositoryPath, { recursive: true, force: true });
  }
});
