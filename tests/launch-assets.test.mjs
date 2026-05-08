import { readFile, stat } from 'node:fs/promises'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const requiredAssets = [
  'docs/demos/demo.gif',
  'docs/demos/flowtake-demo.mp4',
  'docs/screenshots/recording.png',
  'docs/screenshots/editor.png',
  'docs/screenshots/effects.png',
  'docs/launch/social-card.png',
  'docs/launch/README.md',
  'docs/launch/outreach-posts.md',
  'PRESS.md',
]

function pngDimensions(buffer) {
  assert.equal(buffer.toString('ascii', 1, 4), 'PNG')
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  }
}

test('launch assets referenced by the README exist', async () => {
  const readme = await readFile('README.md', 'utf8')

  for (const asset of requiredAssets) {
    assert.match(readme, new RegExp(asset.replaceAll('.', '\\.')), `${asset} should be linked from README.md`)
    const info = await stat(asset)
    assert.ok(info.size > 512, `${asset} should not be empty`)
  }
})

test('launch screenshots use the expected wide media format', async () => {
  for (const file of [
    'docs/screenshots/recording.png',
    'docs/screenshots/editor.png',
    'docs/screenshots/effects.png',
    'docs/launch/social-card.png',
  ]) {
    const buffer = await readFile(file)
    assert.deepEqual(pngDimensions(buffer), { width: 1280, height: 720 })
  }
})

test('demo media has enough weight to be real launch collateral', async () => {
  const gif = await stat('docs/demos/demo.gif')
  const mp4 = await stat('docs/demos/flowtake-demo.mp4')

  assert.ok(gif.size > 100_000, 'demo GIF should contain animation frames')
  assert.ok(mp4.size > 100_000, 'demo MP4 should contain the cut-down demo')
})
