import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

export function verifySiteRelease({ release, version, deploymentCommit, repositoryPath }) {
  assert.match(version, /^\d+\.\d+\.\d+$/u, "site version must be a release version");
  const tag = `v${version}`;
  assert.equal(release.tag_name, tag, "latest release must match the site version");
  assert.equal(release.draft, false, "a draft release cannot back a public site");
  assert.equal(release.prerelease, false, "a prerelease cannot back the stable download link");
  assert.ok(release.assets?.some((asset) => asset.name === "SHA256SUMS.txt" && asset.size > 0), "release must publish nonempty SHA256SUMS.txt");
  const git = (args) => execFileSync("git", args, { cwd: repositoryPath, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  const releaseCommit = git(["rev-parse", "--verify", "--end-of-options", `refs/tags/${tag}^{commit}`]);
  const siteCommit = git(["rev-parse", "--verify", "--end-of-options", `${deploymentCommit}^{commit}`]);
  try {
    git(["merge-base", "--is-ancestor", releaseCommit, siteCommit]);
  } catch {
    throw new Error(`Release ${tag} must be an ancestor of the deployed site commit`);
  }
  return { tag, releaseCommit, siteCommit };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [releaseFile, deploymentCommit] = process.argv.slice(2);
    assert.ok(releaseFile && deploymentCommit, "usage: node scripts/verify-site-release.mjs RELEASE_JSON COMMIT");
    const repositoryPath = fileURLToPath(new URL("../../", import.meta.url));
    const { version } = JSON.parse(await readFile(new URL("../../package.json", import.meta.url), "utf8"));
    const release = JSON.parse(await readFile(releaseFile, "utf8"));
    const result = verifySiteRelease({ release, version, deploymentCommit, repositoryPath });
    process.stdout.write(`Verified ${result.tag} with checksums at ${result.releaseCommit}; site commit ${result.siteCommit}.\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
