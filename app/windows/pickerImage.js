export async function loadPickerImageSrc(imageSource) {
    if (!imageSource || imageSource.startsWith("data:image/")) return imageSource

    throw new Error("Picker screenshots must be supplied by the trusted backend as image data URLs")
}

export function releasePickerImageSrc(src) {
    if (src?.startsWith("blob:")) URL.revokeObjectURL(src)
}
