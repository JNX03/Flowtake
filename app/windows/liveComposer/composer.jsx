// Boot script for the hidden live-composer window.
// This window's only job is to run the Pixi.js scene that produces the
// live-streamed canvas; it has no UI of its own.

import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import LiveCompositor from '@shared/live/LiveCompositor'

const canvas = document.getElementById('composer-canvas')

let compositor = null

async function start(config) {
    if (compositor) return
    compositor = new LiveCompositor({ canvas, config })
    try {
        await compositor.start()

        // Once the canvas is producing frames and the MediaRecorder is rolling,
        // ask the Rust backend to spawn FFmpeg with the matching config.
        await invoke('start_live_streaming', {
            config: {
                rtmpUrl: config.rtmpUrl || '',
                videoBitrateKbps: config.videoBitrateKbps || 6000,
                width: config.width || 1920,
                height: config.height || 1080,
                framerate: config.framerate || 30,
                saveLocal: config.saveLocal !== false,
            },
        })

        window.dispatchEvent(new CustomEvent('live:started'))
    } catch (err) {
        console.error('[live] composer.start failed:', err)
        try { await invoke('close_live_composer') } catch {}
    }
}

async function stop() {
    if (!compositor) return
    try {
        await compositor.stop()
    } catch (err) {
        console.warn('[live] compositor.stop error:', err)
    }
    compositor = null

    try {
        const summary = await invoke('stop_live_streaming')
        window.dispatchEvent(new CustomEvent('live:stopped', { detail: summary }))
    } catch (err) {
        console.warn('[live] stop_live_streaming error:', err)
    }

    try { await invoke('close_live_composer') } catch {}
}

listen('live:start', (event) => {
    start(event.payload || {}).catch(console.error)
})

listen('live:stop', () => {
    stop().catch(console.error)
})

// Tell the recorder window we are ready to receive a `live:start` event.
listen('live:capture-ended', () => {
    stop().catch(console.error)
})

// Ready signal so the recorder/main window knows the composer mounted.
;(async () => {
    try {
        const { emit } = await import('@tauri-apps/api/event')
        emit('live:composer-mounted')
    } catch {}
})()
