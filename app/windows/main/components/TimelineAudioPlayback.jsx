import { useCallback, useEffect, useRef } from "react"
import { useSelector, useStore } from "react-redux"
import {
    findActiveAudioClip,
    getAudioClipPlaybackRate,
    getEffectiveAudioVolume,
    resolveAudioClipRuntimeSource,
    timelineTimeToAudioSourceMs,
} from "@shared/editor/audioTimeline"
import { selectAllAssets } from "@shared/redux/assetSlice"
import {
    selectAllAudioClips,
    selectAudioTracks,
} from "@shared/redux/audioTrackSlice"
import {
    selectIsMuted,
    selectIsPlaying,
} from "@shared/redux/editorSlice"
import { selectTime } from "@shared/redux/timelineSlice"

const MAX_MEDIA_ELEMENT_PLAYBACK_RATE = 16
const MIN_MEDIA_ELEMENT_PLAYBACK_RATE = 0.0625
const PLAYING_DRIFT_TOLERANCE_SECONDS = 0.12
const PAUSED_DRIFT_TOLERANCE_SECONDS = 0.004

const clamp = (value, minimum, maximum) =>
    Math.min(Math.max(value, minimum), maximum)

function releasePlayer(player) {
    if (!player?.element) return
    player.element.pause()
    player.element.removeEventListener("loadedmetadata", player.onLoadedMetadata)
    player.element.removeAttribute("src")
    player.element.load()
    player.playPromise = null
    player.activeClipId = null
    player.src = null
}

/**
 * Keeps one reusable HTMLAudioElement per timeline track. Clips on the same
 * track cannot overlap, so this bounds decoder/memory usage while still
 * allowing independent tracks to mix during preview.
 */
export default function TimelineAudioPlayback() {
    const store = useStore()
    const clips = useSelector(selectAllAudioClips)
    const tracks = useSelector(selectAudioTracks)
    const assets = useSelector(selectAllAssets)
    const playersRef = useRef(new Map())
    const clipsRef = useRef(clips)
    const tracksRef = useRef(tracks)
    const assetsRef = useRef(assets)

    const createPlayer = useCallback(trackId => {
        if (typeof Audio !== "function") return null

        const element = new Audio()
        const player = {
            trackId,
            element,
            activeClipId: null,
            src: null,
            pendingSeekMs: null,
            playPromise: null,
            onLoadedMetadata: null,
        }
        player.onLoadedMetadata = () => {
            if (!Number.isFinite(player.pendingSeekMs)) return
            try {
                element.currentTime = Math.max(0, player.pendingSeekMs / 1000)
            } catch {
                // The next timeline synchronization will retry the seek.
            }
        }
        element.preload = "auto"
        element.addEventListener("loadedmetadata", player.onLoadedMetadata)
        playersRef.current.set(trackId, player)
        return player
    }, [])

    const sync = useCallback(() => {
        const state = store.getState()
        const time = selectTime(state)
        const isPlaying = selectIsPlaying(state)
        const isMuted = selectIsMuted(state)
        const currentTracks = tracksRef.current
        const currentClips = clipsRef.current
        const currentAssets = assetsRef.current
        const currentTrackIds = new Set(currentTracks.map(track => track.id))

        for (const [trackId, player] of playersRef.current) {
            if (!currentTrackIds.has(trackId)) {
                releasePlayer(player)
                playersRef.current.delete(trackId)
            }
        }

        for (const track of currentTracks) {
            const player = playersRef.current.get(track.id) ?? createPlayer(track.id)
            if (!player) continue

            const clip = findActiveAudioClip(currentClips, track.id, time)
            const src = resolveAudioClipRuntimeSource(clip, currentAssets)
            const effectiveVolume = getEffectiveAudioVolume(clip, track)
            const shouldBeAudible = Boolean(
                clip
                && src
                && effectiveVolume > 0
                && !isMuted
            )

            if (!shouldBeAudible) {
                player.element.pause()
                player.playPromise = null
                player.activeClipId = null
                continue
            }

            if (player.src !== src) {
                player.element.pause()
                player.element.src = src
                player.element.load()
                player.src = src
                player.activeClipId = null
            }

            const sourceTimeMs = timelineTimeToAudioSourceMs(clip, time)
            player.pendingSeekMs = sourceTimeMs
            player.element.volume = Math.min(1, effectiveVolume)
            player.element.muted = false
            player.element.playbackRate = clamp(
                getAudioClipPlaybackRate(clip),
                MIN_MEDIA_ELEMENT_PLAYBACK_RATE,
                MAX_MEDIA_ELEMENT_PLAYBACK_RATE
            )

            const targetSeconds = sourceTimeMs / 1000
            const isNewClip = player.activeClipId !== clip.id
            const drift = Math.abs(player.element.currentTime - targetSeconds)
            const seekTolerance = isPlaying
                ? PLAYING_DRIFT_TOLERANCE_SECONDS
                : PAUSED_DRIFT_TOLERANCE_SECONDS

            if (isNewClip || drift > seekTolerance) {
                try {
                    player.element.currentTime = Math.max(0, targetSeconds)
                } catch {
                    // loadedmetadata retries the pending source time.
                }
            }
            player.activeClipId = clip.id

            if (!isPlaying) {
                player.element.pause()
                player.playPromise = null
                continue
            }

            if (player.element.paused && !player.playPromise) {
                const request = player.element.play()
                player.playPromise = request
                Promise.resolve(request)
                    .catch(error => {
                        if (error?.name !== "AbortError") {
                            console.warn("[timeline-audio] Preview playback was blocked", error)
                        }
                    })
                    .finally(() => {
                        if (player.playPromise === request) player.playPromise = null
                    })
            }
        }
    }, [createPlayer, store])

    useEffect(() => {
        clipsRef.current = clips
        tracksRef.current = tracks
        assetsRef.current = assets
        sync()
    }, [assets, clips, sync, tracks])

    useEffect(() => {
        const unsubscribe = store.subscribe(sync)
        sync()
        return unsubscribe
    }, [store, sync])

    useEffect(() => () => {
        for (const player of playersRef.current.values()) releasePlayer(player)
        playersRef.current.clear()
    }, [])

    return null
}
