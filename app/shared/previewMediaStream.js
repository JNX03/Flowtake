const stoppedStreams = new WeakSet()
const detachAbortByStream = new WeakMap()

export function stopPreviewMediaStream(stream) {
  if (!stream) return

  detachAbortByStream.get(stream)?.()
  detachAbortByStream.delete(stream)

  if (stoppedStreams.has(stream)) return

  stoppedStreams.add(stream)
  for (const track of stream.getTracks()) {
    try {
      track.stop()
    } catch {
      // A broken track must not prevent the remaining tracks from being stopped.
    }
  }
}

export async function acquirePreviewMediaStream({
  mediaDevices,
  constraints,
  expectedVideoTrackLabel,
  expectedAudioTrackLabel,
  signal,
}) {
  const stream = await mediaDevices.getUserMedia(constraints)
  const stopOnAbort = () => stopPreviewMediaStream(stream)

  try {
    signal?.addEventListener("abort", stopOnAbort, { once: true })
    if (signal) {
      detachAbortByStream.set(
        stream,
        () => signal.removeEventListener("abort", stopOnAbort)
      )
    }

    if (signal?.aborted) {
      stopPreviewMediaStream(stream)
      return null
    }

    const hasExpectedVideoTrack = !expectedVideoTrackLabel || stream
      .getVideoTracks()
      .some(track => track.label === expectedVideoTrackLabel)
    const hasExpectedAudioTrack = !expectedAudioTrackLabel || stream
      .getAudioTracks()
      .some(track => track.label === expectedAudioTrackLabel)

    if (!hasExpectedVideoTrack || !hasExpectedAudioTrack) {
      const error = new Error("Media track not found")
      error.name = "MediaTrackError"
      throw error
    }

    return stream
  } catch (error) {
    stopPreviewMediaStream(stream)
    throw error
  }
}
