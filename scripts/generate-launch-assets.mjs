import { execFile } from 'node:child_process'
import { mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import sharp from 'sharp'

const execFileAsync = promisify(execFile)

const root = process.cwd()
const demoDir = path.join(root, 'docs/demos')
const screenshotDir = path.join(root, 'docs/screenshots')
const launchDir = path.join(root, 'docs/launch')
const frameDir = path.join(root, '.launch-frames')

const W = 1280
const H = 720
const FPS = 24
const DURATION = 8
const FRAME_COUNT = FPS * DURATION

const palette = {
  bg: '#08111f',
  panel: '#111827',
  panel2: '#172033',
  rail: '#0d1424',
  ink: '#f7fbff',
  muted: '#98a6bd',
  line: '#2a3448',
  primary: '#8b5cf6',
  cyan: '#2dd4bf',
  green: '#22c55e',
  yellow: '#facc15',
  red: '#f43f5e',
  orange: '#fb923c',
  blue: '#60a5fa'
}

const esc = value => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')

const clamp = (v, min, max) => Math.max(min, Math.min(max, v))
const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

function text(x, y, value, options = {}) {
  const {
    size = 24,
    fill = palette.ink,
    weight = 500,
    anchor = 'start',
    opacity = 1,
    family = 'Inter, Arial, sans-serif',
    spacing = 0
  } = options

  return `<text x="${x}" y="${y}" fill="${fill}" fill-opacity="${opacity}" font-size="${size}" font-family="${family}" font-weight="${weight}" text-anchor="${anchor}" letter-spacing="${spacing}">${esc(value)}</text>`
}

function label(x, y, value, color = palette.primary) {
  return `
    <rect x="${x}" y="${y}" width="${value.length * 8 + 30}" height="30" rx="15" fill="${color}" fill-opacity="0.16" stroke="${color}" stroke-opacity="0.45"/>
    ${text(x + 15, y + 20, value, { size: 13, fill: color, weight: 700 })}
  `
}

function button(x, y, w, h, value, options = {}) {
  const { fill = palette.primary, textFill = '#ffffff', opacity = 1 } = options
  return `
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${fill}" fill-opacity="${opacity}"/>
    ${text(x + w / 2, y + h / 2 + 6, value, { size: 16, fill: textFill, weight: 800, anchor: 'middle' })}
  `
}

function windowChrome(x, y, w, h, title = 'Flowtake') {
  return `
    <g filter="url(#shadow)">
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="22" fill="${palette.panel}" stroke="#334155" stroke-opacity="0.6"/>
      <rect x="${x}" y="${y}" width="${w}" height="46" rx="22" fill="#0c1322"/>
      <rect x="${x}" y="${y + 24}" width="${w}" height="24" fill="#0c1322"/>
      <circle cx="${x + 24}" cy="${y + 23}" r="6" fill="#fb7185"/>
      <circle cx="${x + 44}" cy="${y + 23}" r="6" fill="#fbbf24"/>
      <circle cx="${x + 64}" cy="${y + 23}" r="6" fill="#34d399"/>
      ${text(x + w / 2, y + 29, title, { size: 14, fill: '#dbeafe', weight: 700, anchor: 'middle' })}
    </g>
  `
}

function defs() {
  return `
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#0f172a"/>
        <stop offset="0.42" stop-color="#172554"/>
        <stop offset="0.68" stop-color="#0f766e"/>
        <stop offset="1" stop-color="#111827"/>
      </linearGradient>
      <linearGradient id="card" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#1e293b"/>
        <stop offset="1" stop-color="#0f172a"/>
      </linearGradient>
      <linearGradient id="warm" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#fb923c"/>
        <stop offset="1" stop-color="#8b5cf6"/>
      </linearGradient>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="150%">
        <feDropShadow dx="0" dy="24" stdDeviation="24" flood-color="#000000" flood-opacity="0.38"/>
      </filter>
      <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="16"/>
      </filter>
      <clipPath id="previewClip">
        <rect x="150" y="166" width="690" height="390" rx="18"/>
      </clipPath>
      <clipPath id="editorPreviewClip">
        <rect x="396" y="134" width="548" height="342" rx="16"/>
      </clipPath>
    </defs>
  `
}

function background() {
  return `
    <rect width="${W}" height="${H}" fill="url(#bg)"/>
    <path d="M0 580 C180 500 280 650 460 590 C680 516 760 410 980 500 C1120 560 1200 520 1280 470 L1280 720 L0 720 Z" fill="#020617" fill-opacity="0.34"/>
    <circle cx="1090" cy="118" r="140" fill="#14b8a6" fill-opacity="0.16" filter="url(#soft)"/>
    <circle cx="230" cy="612" r="170" fill="#fb923c" fill-opacity="0.13" filter="url(#soft)"/>
  `
}

function header(sceneNumber, title, subtitle) {
  return `
    <g>
      ${text(78, 66, 'Flowtake', { size: 28, fill: '#ffffff', weight: 900 })}
      ${label(79, 80, `Cut ${sceneNumber}`, palette.cyan)}
      ${text(245, 66, title, { size: 30, fill: '#ffffff', weight: 900 })}
      ${text(245, 95, subtitle, { size: 17, fill: '#cbd5e1', weight: 500 })}
      <path d="M78 112 L548 112" stroke="#ffffff" stroke-opacity="0.16"/>
    </g>
  `
}

function fauxScreen(x, y, w, h, p = 0) {
  const cursorX = x + 105 + ease(p) * (w - 210)
  const cursorY = y + 95 + Math.sin(p * Math.PI) * 76
  const zoomW = 190 + Math.sin(p * Math.PI) * 16
  return `
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="18" fill="#dbeafe"/>
    <rect x="${x + 22}" y="${y + 22}" width="${w - 44}" height="${h - 44}" rx="14" fill="#0f172a"/>
    <rect x="${x + 44}" y="${y + 46}" width="260" height="250" rx="12" fill="#111827"/>
    <rect x="${x + 330}" y="${y + 46}" width="${w - 390}" height="68" rx="14" fill="#ffffff" fill-opacity="0.94"/>
    <rect x="${x + 330}" y="${y + 132}" width="${w - 390}" height="164" rx="14" fill="#f8fafc"/>
    ${text(x + 354, y + 76, 'github.com/JNX03/Flowtake', { size: 16, fill: '#0f172a', weight: 800 })}
    ${text(x + 354, y + 104, 'Screen recordings, automatically animated.', { size: 12, fill: '#475569', weight: 600 })}
    ${text(x + 66, y + 84, 'recorder.js', { size: 15, fill: palette.cyan, weight: 800 })}
    ${[0, 1, 2, 3, 4, 5].map(i => `<rect x="${x + 66}" y="${y + 112 + i * 28}" width="${145 + (i % 3) * 42}" height="10" rx="5" fill="${i % 2 ? palette.primary : palette.blue}" fill-opacity="${i % 2 ? 0.42 : 0.52}"/>`).join('')}
    <rect x="${cursorX - zoomW / 2}" y="${cursorY - 72}" width="${zoomW}" height="128" rx="14" fill="none" stroke="${palette.yellow}" stroke-width="4" stroke-opacity="0.9"/>
    <path d="M${cursorX} ${cursorY} l0 58 l18 -16 l15 32 l18 -9 l-16 -31 l25 0 Z" fill="#ffffff" stroke="#020617" stroke-width="3"/>
    <circle cx="${cursorX}" cy="${cursorY}" r="${28 + Math.sin(p * Math.PI) * 10}" fill="${palette.cyan}" fill-opacity="0.14" stroke="${palette.cyan}" stroke-opacity="0.55"/>
  `
}

function sceneRecord(t) {
  const p = clamp(t / 2, 0, 1)
  return `
    ${header(1, 'Record once', 'Capture your screen, camera, mic, and system audio locally.')}
    ${windowChrome(110, 120, 1060, 520, 'Flowtake - New Recording')}
    <rect x="136" y="152" width="48" height="464" fill="${palette.rail}" rx="14"/>
    ${['R', 'P', 'G', 'S'].map((v, i) => `<rect x="148" y="${176 + i * 72}" width="24" height="24" rx="7" fill="${i === 0 ? palette.primary : '#243044'}"/><text x="160" y="${193 + i * 72}" fill="#fff" font-family="Arial" font-size="12" font-weight="800" text-anchor="middle">${v}</text>`).join('')}
    <rect x="150" y="166" width="690" height="390" rx="18" fill="#0b1220" stroke="${palette.line}"/>
    <g clip-path="url(#previewClip)">
      ${fauxScreen(174, 190, 642, 342, p)}
    </g>
    <rect x="188" y="518" width="112" height="28" rx="14" fill="#000000" fill-opacity="0.55"/>
    ${text(212, 537, 'Screen', { size: 13, fill: '#ffffff', weight: 800 })}
    <rect x="706" y="518" width="92" height="28" rx="14" fill="#000000" fill-opacity="0.55"/>
    ${text(735, 537, 'Live', { size: 13, fill: '#ffffff', weight: 800 })}
    <circle cx="724" cy="531" r="5" fill="${palette.red}"/>
    <rect x="872" y="166" width="250" height="390" rx="18" fill="#0f172a" stroke="${palette.line}"/>
    ${text(894, 204, 'Source', { size: 14, fill: palette.muted, weight: 800 })}
    <rect x="894" y="220" width="66" height="58" rx="12" fill="${palette.primary}" fill-opacity="0.22" stroke="${palette.primary}"/>
    <rect x="970" y="220" width="66" height="58" rx="12" fill="#1f2937"/>
    <rect x="1046" y="220" width="54" height="58" rx="12" fill="#1f2937"/>
    ${text(927, 254, 'Screen', { size: 11, fill: '#ffffff', weight: 800, anchor: 'middle' })}
    ${text(1003, 254, 'Window', { size: 11, fill: '#cbd5e1', weight: 800, anchor: 'middle' })}
    ${text(1073, 254, 'Area', { size: 11, fill: '#cbd5e1', weight: 800, anchor: 'middle' })}
    ${text(894, 318, 'Devices', { size: 14, fill: palette.muted, weight: 800 })}
    <rect x="894" y="334" width="206" height="42" rx="12" fill="#1f2937"/>
    ${text(912, 361, 'Camera + Microphone', { size: 14, fill: '#e2e8f0', weight: 700 })}
    <rect x="894" y="392" width="206" height="42" rx="12" fill="#1f2937"/>
    ${text(912, 419, 'System audio enabled', { size: 14, fill: '#e2e8f0', weight: 700 })}
    ${button(894, 488, 206, 48, 'Start recording', { fill: palette.red })}
    <circle cx="915" cy="512" r="${9 + Math.sin(p * Math.PI * 8) * 2}" fill="#ffffff" fill-opacity="0.26"/>
  `
}

function timeline(x, y, w, p = 0) {
  const playhead = x + 68 + ease(p) * (w - 130)
  return `
    <rect x="${x}" y="${y}" width="${w}" height="104" rx="16" fill="#0b1220" stroke="${palette.line}"/>
    ${[0, 1, 2, 3, 4, 5, 6].map(i => `<line x1="${x + 54 + i * 132}" y1="${y + 14}" x2="${x + 54 + i * 132}" y2="${y + 92}" stroke="#334155" stroke-opacity="0.55"/><text x="${x + 47 + i * 132}" y="${y + 28}" fill="#64748b" font-family="Arial" font-size="11">0:${String(i * 5).padStart(2, '0')}</text>`).join('')}
    <rect x="${x + 54}" y="${y + 42}" width="${w - 108}" height="20" rx="10" fill="${palette.blue}" fill-opacity="0.55"/>
    <rect x="${x + 110}" y="${y + 70}" width="144" height="16" rx="8" fill="${palette.primary}" fill-opacity="0.78"/>
    <rect x="${x + 338}" y="${y + 70}" width="168" height="16" rx="8" fill="${palette.cyan}" fill-opacity="0.72"/>
    <rect x="${x + 610}" y="${y + 70}" width="126" height="16" rx="8" fill="${palette.yellow}" fill-opacity="0.72"/>
    <line x1="${playhead}" y1="${y + 10}" x2="${playhead}" y2="${y + 98}" stroke="#ffffff" stroke-width="3"/>
    <circle cx="${playhead}" cy="${y + 11}" r="7" fill="#ffffff"/>
  `
}

function sceneEditor(t) {
  const p = clamp((t - 2) / 2, 0, 1)
  const zoom = 1 + Math.sin(p * Math.PI) * 0.09
  return `
    ${header(2, 'Let motion become edits', 'Auto-zoom, cursor smoothing, cuts, captions, and timeline control.')}
    ${windowChrome(92, 102, 1096, 552, 'Flowtake - Editor')}
    <rect x="116" y="150" width="244" height="348" rx="18" fill="#0f172a" stroke="${palette.line}"/>
    <rect x="132" y="166" width="36" height="316" rx="12" fill="${palette.rail}"/>
    ${['BG', 'C', 'Z', 'M', 'CC'].map((v, i) => `<rect x="140" y="${184 + i * 54}" width="20" height="20" rx="6" fill="${i === 2 ? palette.primary : '#243044'}"/><text x="150" y="${198 + i * 54}" fill="#fff" font-family="Arial" font-size="8" font-weight="800" text-anchor="middle">${v}</text>`).join('')}
    ${text(186, 186, 'Zooms', { size: 22, weight: 900 })}
    <rect x="186" y="212" width="146" height="44" rx="12" fill="#1e293b"/>
    ${text(202, 239, 'Auto zoom 140%', { size: 14, fill: '#dbeafe', weight: 700 })}
    <rect x="186" y="270" width="146" height="44" rx="12" fill="#1e293b"/>
    ${text(202, 297, 'Cursor inertia', { size: 14, fill: '#dbeafe', weight: 700 })}
    <rect x="186" y="328" width="146" height="44" rx="12" fill="#1e293b"/>
    ${text(202, 355, 'Click rings', { size: 14, fill: '#dbeafe', weight: 700 })}
    <rect x="396" y="134" width="548" height="342" rx="16" fill="#020617" stroke="${palette.line}"/>
    <g clip-path="url(#editorPreviewClip)" transform="translate(${396 + 274} ${134 + 171}) scale(${zoom}) translate(${-396 - 274} ${-134 - 171})">
      ${fauxScreen(420, 158, 500, 292, p)}
      <rect x="520" y="382" width="276" height="42" rx="20" fill="#020617" fill-opacity="0.74" stroke="#ffffff" stroke-opacity="0.12"/>
      ${text(658, 409, 'Built-in captions stay local', { size: 16, fill: '#ffffff', weight: 900, anchor: 'middle' })}
    </g>
    <path d="M548 354 C616 286 698 320 770 238" stroke="${palette.yellow}" stroke-width="5" stroke-linecap="round" fill="none" stroke-dasharray="14 12"/>
    <circle cx="${548 + ease(p) * 222}" cy="${354 - Math.sin(p * Math.PI) * 90}" r="18" fill="${palette.yellow}" fill-opacity="0.16" stroke="${palette.yellow}" stroke-width="3"/>
    <rect x="974" y="150" width="184" height="348" rx="18" fill="#0f172a" stroke="${palette.line}"/>
    ${text(996, 186, 'Export-ready', { size: 19, weight: 900 })}
    ${['Auto pans', 'Blur masks', 'Camera layout', 'Audio tracks', 'Presets'].map((v, i) => `
      <rect x="996" y="${214 + i * 46}" width="134" height="30" rx="15" fill="#1e293b"/>
      <circle cx="1014" cy="${229 + i * 46}" r="5" fill="${[palette.green, palette.cyan, palette.primary, palette.orange, palette.blue][i]}"/>
      ${text(1028, 234 + i * 46, v, { size: 13, fill: '#dbeafe', weight: 700 })}
    `).join('')}
    ${timeline(116, 520, 1042, p)}
  `
}

function sceneEffects(t) {
  const p = clamp((t - 4) / 2, 0, 1)
  const reveal = ease(p)
  return `
    ${header(3, 'Polish without leaving the app', 'Blur secrets, add overlays, tune backgrounds, and caption the story.')}
    ${windowChrome(98, 110, 1084, 520, 'Flowtake - Effects')}
    <rect x="136" y="158" width="300" height="388" rx="18" fill="#0f172a" stroke="${palette.line}"/>
    ${text(164, 198, 'Effects panel', { size: 23, weight: 900 })}
    ${['Background blur', 'Cursor spotlight', 'Redaction mask', 'Subtitle style', 'Overlay track'].map((v, i) => `
      <rect x="164" y="${226 + i * 54}" width="230" height="36" rx="12" fill="#1e293b"/>
      <rect x="286" y="${239 + i * 54}" width="${54 + i * 12}" height="10" rx="5" fill="${[palette.cyan, palette.yellow, palette.red, palette.primary, palette.green][i]}" fill-opacity="0.78"/>
      ${text(180, 250 + i * 54, v, { size: 13, fill: '#e2e8f0', weight: 700 })}
    `).join('')}
    <rect x="474" y="158" width="648" height="388" rx="18" fill="#020617" stroke="${palette.line}"/>
    <rect x="510" y="192" width="576" height="314" rx="22" fill="#dbeafe"/>
    <rect x="548" y="232" width="226" height="210" rx="16" fill="#111827"/>
    <rect x="804" y="232" width="246" height="66" rx="16" fill="#ffffff" fill-opacity="0.95"/>
    <rect x="804" y="318" width="246" height="124" rx="16" fill="#f8fafc"/>
    ${text(830, 272, 'Demo project dashboard', { size: 18, fill: '#0f172a', weight: 900 })}
    ${text(830, 352, 'api_key =', { size: 17, fill: '#334155', weight: 700 })}
    <rect x="910" y="332" width="${38 + reveal * 118}" height="30" rx="10" fill="#111827" fill-opacity="${0.18 + reveal * 0.72}"/>
    ${text(968, 353, reveal > 0.42 ? 'blurred' : 'secret', { size: 14, fill: reveal > 0.42 ? '#ffffff' : '#64748b', weight: 900, anchor: 'middle' })}
    <rect x="610" y="390" width="360" height="48" rx="22" fill="#020617" fill-opacity="0.78" stroke="#ffffff" stroke-opacity="0.12"/>
    ${text(790, 421, 'Protect secrets before you export', { size: 18, fill: '#ffffff', weight: 900, anchor: 'middle' })}
    <path d="M642 228 C690 190 742 204 802 182" stroke="${palette.cyan}" stroke-width="5" stroke-linecap="round" fill="none"/>
    <circle cx="${642 + reveal * 160}" cy="${228 - Math.sin(reveal * Math.PI) * 48}" r="18" fill="${palette.cyan}" fill-opacity="0.15" stroke="${palette.cyan}" stroke-width="3"/>
    ${timeline(136, 566, 986, p)}
  `
}

function sceneExport(t) {
  const p = clamp((t - 6) / 2, 0, 1)
  const progress = Math.round(34 + ease(p) * 66)
  return `
    ${header(4, 'Ship the polished take', 'Export MP4/WebM, share the repo, and invite makers to star it.')}
    ${windowChrome(138, 116, 1004, 500, 'Flowtake - Export')}
    <rect x="176" y="170" width="448" height="350" rx="20" fill="#0f172a" stroke="${palette.line}"/>
    ${text(206, 212, 'Render queue', { size: 25, weight: 900 })}
    <rect x="206" y="244" width="370" height="74" rx="16" fill="#1e293b"/>
    ${text(232, 276, 'flowtake-demo.mp4', { size: 18, fill: '#ffffff', weight: 900 })}
    <rect x="232" y="292" width="292" height="10" rx="5" fill="#334155"/>
    <rect x="232" y="292" width="${292 * progress / 100}" height="10" rx="5" fill="url(#warm)"/>
    ${text(540, 302, `${progress}%`, { size: 13, fill: '#cbd5e1', weight: 800, anchor: 'end' })}
    ${button(206, 352, 154, 48, 'Reveal file', { fill: palette.cyan })}
    ${button(376, 352, 154, 48, 'Upload', { fill: palette.primary })}
    <rect x="668" y="170" width="428" height="350" rx="20" fill="#f8fafc"/>
    ${text(704, 224, 'GitHub launch page', { size: 29, fill: '#0f172a', weight: 900 })}
    ${text(704, 260, 'Demo GIF, screenshots, press kit, and launch copy.', { size: 16, fill: '#475569', weight: 600 })}
    <rect x="704" y="296" width="318" height="58" rx="16" fill="#0f172a"/>
    ${text(730, 333, 'Star JNX03/Flowtake', { size: 22, fill: '#ffffff', weight: 900 })}
    <path d="M1010 316 l8 16 l18 2 l-13 12 l3 18 l-16 -9 l-16 9 l3 -18 l-13 -12 l18 -2 Z" fill="${palette.yellow}"/>
    <rect x="704" y="386" width="144" height="26" rx="13" fill="#dcfce7"/>
    ${text(776, 405, 'MIT licensed', { size: 13, fill: '#166534', weight: 900, anchor: 'middle' })}
    <rect x="864" y="386" width="178" height="26" rx="13" fill="#dbeafe"/>
    ${text(953, 405, 'Local by default', { size: 13, fill: '#1e40af', weight: 900, anchor: 'middle' })}
    ${text(640, 580, 'Open source Screen Studio-style recording for Windows, macOS, and Linux.', { size: 25, fill: '#ffffff', weight: 900, anchor: 'middle' })}
  `
}

function frameSvg(frame) {
  const t = frame / FPS
  let body
  if (t < 2) body = sceneRecord(t)
  else if (t < 4) body = sceneEditor(t)
  else if (t < 6) body = sceneEffects(t)
  else body = sceneExport(t)

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
      ${defs()}
      ${background()}
      ${body}
    </svg>
  `
}

async function renderPng(file, svg) {
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(file)
}

async function renderVideo() {
  await rm(frameDir, { recursive: true, force: true })
  await mkdir(frameDir, { recursive: true })

  for (let i = 0; i < FRAME_COUNT; i += 1) {
    const frame = String(i + 1).padStart(4, '0')
    await renderPng(path.join(frameDir, `frame-${frame}.png`), frameSvg(i))
  }

  await execFileAsync('ffmpeg', [
    '-y',
    '-framerate', String(FPS),
    '-i', path.join(frameDir, 'frame-%04d.png'),
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    path.join(demoDir, 'flowtake-demo.mp4')
  ])

  await execFileAsync('ffmpeg', [
    '-y',
    '-i', path.join(demoDir, 'flowtake-demo.mp4'),
    '-vf', 'fps=12,scale=960:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse=dither=bayer:bayer_scale=5',
    path.join(demoDir, 'demo.gif')
  ])

  await rm(frameDir, { recursive: true, force: true })
}

async function main() {
  await mkdir(demoDir, { recursive: true })
  await mkdir(screenshotDir, { recursive: true })
  await mkdir(launchDir, { recursive: true })

  await renderPng(path.join(screenshotDir, 'recording.png'), frameSvg(24))
  await renderPng(path.join(screenshotDir, 'editor.png'), frameSvg(82))
  await renderPng(path.join(screenshotDir, 'effects.png'), frameSvg(130))
  await renderPng(path.join(launchDir, 'social-card.png'), frameSvg(170))
  await renderVideo()

  console.log('Generated Flowtake launch assets:')
  console.log('  docs/demos/flowtake-demo.mp4')
  console.log('  docs/demos/demo.gif')
  console.log('  docs/screenshots/recording.png')
  console.log('  docs/screenshots/editor.png')
  console.log('  docs/screenshots/effects.png')
  console.log('  docs/launch/social-card.png')
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
