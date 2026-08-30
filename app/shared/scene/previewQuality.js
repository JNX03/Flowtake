export const PREVIEW_TEXTURE_MAX_WIDTH = 1280
export const PREVIEW_TEXTURE_MAX_HEIGHT = 720

export function getPreviewTextureDimensions(
    source,
    maxWidth = PREVIEW_TEXTURE_MAX_WIDTH,
    maxHeight = PREVIEW_TEXTURE_MAX_HEIGHT
) {
    const width = Math.max(1, Math.floor(Number(source?.x) || 1))
    const height = Math.max(1, Math.floor(Number(source?.y) || 1))
    const scale = Math.min(1, maxWidth / width, maxHeight / height)

    return {
        x: Math.max(1, Math.floor(width * scale)),
        y: Math.max(1, Math.floor(height * scale)),
    }
}
