import { convertFileSrc } from "@tauri-apps/api/core"
import { readFile } from "@tauri-apps/plugin-fs"

const getMimeType = filePath => filePath?.toLowerCase().endsWith(".bmp")
    ? "image/bmp"
    : "image/png"

export async function loadPickerImageSrc(filePath) {
    if (!filePath || filePath.startsWith("data:")) return filePath

    try {
        const bytes = await readFile(filePath)
        const blob = new Blob([bytes], { type: getMimeType(filePath) })
        return URL.createObjectURL(blob)
    } catch (e) {
        console.warn("[PickerImage] Falling back to asset URL:", e)
        return convertFileSrc(filePath)
    }
}

export function releasePickerImageSrc(src) {
    if (src?.startsWith("blob:")) URL.revokeObjectURL(src)
}
