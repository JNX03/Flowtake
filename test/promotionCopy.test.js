import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("standalone launch posts fit X and keep source improvements out of the download claims", async () => {
  const copy = await readFile(new URL("../docs/launch/october-social-posts.md", import.meta.url), "utf8");
  const xPosts = copy.slice(copy.indexOf("## X:"), copy.indexOf("## Reddit:"));
  const posts = [...xPosts.matchAll(/```text\n([\s\S]*?)\n```/gu)].map((match) => match[1]);
  assert.equal(posts.length, 2);
  for (const post of posts) {
    // ASCII text avoids weighted Unicode differences; URLs use X's 23-character length.
    const weighted = post.replace(/https:\/\/\S+/gu, "x".repeat(23));
    assert.ok([...weighted].every((character) => character.codePointAt(0) <= 127));
    assert.ok(weighted.length <= 280, `post is ${weighted.length} characters`);
  }
  assert.match(posts[0], /macOS\/Linux previews/u);
  assert.match(posts[0], /Install FFmpeg separately/u);
  assert.match(posts[1], /published download is still v1\.7\.2/u);
  const hn = await readFile(new URL("../docs/launch/show-hn.md", import.meta.url), "utf8");
  assert.match(hn, /not submitted/u);
  assert.equal(hn.includes("## First comment"), false);
});
