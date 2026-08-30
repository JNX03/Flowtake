export function isAudioTrackAvailable(track, audioClips, start, end) {
    if (!track || track.locked || !Number.isFinite(start) || !Number.isFinite(end) || end <= start) return false

    return !audioClips.some(clip =>
        clip.trackIndex === track.id && clip.start < end && clip.end > start
    )
}

export function resolveAudioTrackPlacement({
    tracks,
    audioClips,
    start,
    end,
    nextTrackId,
    preferredTrackId = null,
}) {
    const preferredTrack = preferredTrackId === null
        ? null
        : tracks.find(track => track.id === preferredTrackId)
    const availableTrack = preferredTrack && isAudioTrackAvailable(preferredTrack, audioClips, start, end)
        ? preferredTrack
        : tracks.find(track => isAudioTrackAvailable(track, audioClips, start, end))

    return {
        trackId: availableTrack?.id ?? nextTrackId,
        needsNewTrack: !availableTrack,
    }
}
