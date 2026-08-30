import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import assetReducer, {
    addAsset,
    makeSelectLibraryAssets,
    removeAssets,
    selectAllAssets,
    setAssets,
} from "../app/shared/redux/assetSlice.js"

const assetPanelSource = await readFile(
    new URL("../app/windows/main/components/assets/AssetPanel.jsx", import.meta.url),
    "utf8"
)
const mainWindowHtml = await readFile(
    new URL("../app/windows/main/index.html", import.meta.url),
    "utf8"
)

function createAssetState(assets) {
    return {
        assets: assetReducer(undefined, setAssets(assets))
    }
}

const libraryFixtures = [
    {
        id: "import-1000000000000-video",
        name: "Zeta Walkthrough.mp4",
        type: "video",
        category: "media",
        mimeType: "video/mp4",
        createdAt: 100,
    },
    {
        id: "import-3000000000000-image",
        name: "Alpha Cover.png",
        type: "image",
        category: "media",
        mimeType: "image/png",
        createdAt: 300,
    },
    {
        id: "audio-2000000000000-track",
        name: "Theme Song.wav",
        type: "audio",
        category: "audio",
        mimeType: "audio/wav",
        createdAt: 200,
    },
]

test("asset imports receive creation metadata and batch removal stays atomic", () => {
    let state = assetReducer(undefined, { type: "@@init" })
    const action = addAsset({
        id: "import-now",
        name: "New still.png",
        type: "image",
        category: "media",
    })

    assert.equal(typeof action.payload.createdAt, "number")

    state = assetReducer(state, action)
    state = assetReducer(state, addAsset({
        id: "audio-now",
        name: "New sound.wav",
        type: "audio",
        category: "audio",
        createdAt: 10,
    }))
    state = assetReducer(state, removeAssets(["import-now", "audio-now"]))

    assert.deepEqual(selectAllAssets({ assets: state }), [])
})

test("library selector memoizes case-insensitive search and category filtering", () => {
    const state = createAssetState(libraryFixtures)
    const selectLibrary = makeSelectLibraryAssets()
    const firstResult = selectLibrary(state, "media", "VIDEO", "name")
    const secondResult = selectLibrary(state, "media", "VIDEO", "name")
    const unrelatedState = { ...state, transientEditorValue: 42 }

    assert.deepEqual(firstResult.map(asset => asset.id), [
        "import-1000000000000-video"
    ])
    assert.strictEqual(firstResult, secondResult)
    assert.strictEqual(
        firstResult,
        selectLibrary(unrelatedState, "media", "VIDEO", "name")
    )
})

test("library selector sorts by newest, name, and type without mutating entities", () => {
    const state = createAssetState(libraryFixtures)
    const originalOrder = selectAllAssets(state).map(asset => asset.id)
    const selectLibrary = makeSelectLibraryAssets()

    assert.deepEqual(
        selectLibrary(state, "media", "", "newest").map(asset => asset.name),
        ["Alpha Cover.png", "Zeta Walkthrough.mp4"]
    )
    assert.deepEqual(
        selectLibrary(state, "media", "", "name").map(asset => asset.name),
        ["Alpha Cover.png", "Zeta Walkthrough.mp4"]
    )
    assert.deepEqual(
        selectLibrary(state, "media", "", "type").map(asset => asset.type),
        ["image", "video"]
    )
    assert.deepEqual(
        selectAllAssets(state).map(asset => asset.id),
        originalOrder
    )
})

test("asset panel exposes persistent views and accessible batch selection controls", () => {
    assert.match(assetPanelSource, /flowtake:asset-library-view:v1/)
    assert.match(assetPanelSource, /localStorage\.getItem/)
    assert.match(assetPanelSource, /localStorage\.setItem/)
    assert.match(assetPanelSource, /aria-label="Search library"/)
    assert.match(assetPanelSource, /<option value="newest">Newest<\/option>/)
    assert.match(assetPanelSource, /<option value="name">Name<\/option>/)
    assert.match(assetPanelSource, /<option value="type">Type<\/option>/)
    assert.match(assetPanelSource, /aria-label="Grid view"/)
    assert.match(assetPanelSource, /aria-label="List view"/)
    assert.match(assetPanelSource, /event\.ctrlKey \|\| event\.metaKey/)
    assert.match(assetPanelSource, /event\.shiftKey/)
    assert.match(assetPanelSource, /dispatch\(removeAssets\(assetIds\)\)/)
    assert.match(assetPanelSource, /referencedAssetIds\.has\(assetId\)/)
    assert.match(assetPanelSource, /used on the timeline/)
    assert.match(assetPanelSource, /aria-multiselectable="true"/)
    assert.match(assetPanelSource, /aria-selected=\{isSelected\}/)
})

test("asset panel keeps file import, OS drop, and pointer timeline drag behavior", () => {
    assert.match(assetPanelSource, /input\.accept = accept/)
    assert.match(assetPanelSource, /openSessionOnlyPicker\("video\/\*,image\/\*", "import"\)/)
    assert.match(assetPanelSource, /openSessionOnlyPicker\("audio\/\*", "audio"\)/)
    assert.match(assetPanelSource, /e\.dataTransfer\.types\.includes\("Files"\)/)
    assert.match(assetPanelSource, /files\.forEach\(file => importFileAsAsset\(dispatch, file\)\)/)
    assert.match(assetPanelSource, /startDrag\(asset\.type \|\| asset\.category, asset, e\)/)
    assert.match(assetPanelSource, /event\.button === 0 && !isUnavailable/)
})

test("asset panel memoizes built-in category lists", () => {
    assert.match(assetPanelSource, /useSelector\(selectBuiltInAssets\)/)
    assert.match(
        assetPanelSource,
        /\(\) => builtInAssets\.filter\(asset => asset\.category === "text"\)/
    )
    assert.match(
        assetPanelSource,
        /\(\) => builtInAssets\.filter\(asset => asset\.category === "shapes"\)/
    )
    assert.doesNotMatch(
        assetPanelSource,
        /useSelector\(state => selectBuiltInAssetsByCategory/
    )
})

test("asset thumbnails fail cleanly without exposing overflowing alt text", () => {
    assert.match(assetPanelSource, /function MediaThumbnail\(/)
    assert.match(assetPanelSource, /onError=\{\(\) => setHasPreviewError\(true\)\}/)
    assert.match(assetPanelSource, /alt=""/)
    assert.match(assetPanelSource, /const PreviewIcon = isImage \? PhotoIcon : FilmIcon/)
    assert.match(assetPanelSource, /max-w-full truncate px-0\.5 text-\[10px\]/)
})

test("asset grid uses compact fixed cards and list rows", () => {
    assert.match(
        assetPanelSource,
        /grid-cols-\[repeat\(auto-fill,7rem\)\] content-start justify-start/
    )
    assert.match(assetPanelSource, /relative aspect-video w-full/)
    assert.match(
        assetPanelSource,
        /block min-w-0 max-w-full truncate px-0\.5 text-\[10px\]/
    )
    assert.match(
        assetPanelSource,
        /flex h-8 min-w-0 cursor-grab items-center/
    )
    assert.match(assetPanelSource, /h-6 w-8 shrink-0/)
})

test("main window CSP permits the Tauri WebView2 asset origin", () => {
    const csp = mainWindowHtml.match(
        /<meta http-equiv="Content-Security-Policy" content="([^"]+)"/
    )?.[1]

    assert.ok(csp)
    for (const directive of ["default-src", "img-src", "media-src", "connect-src"]) {
        const value = csp
            .split(";")
            .find(candidate => candidate.trim().startsWith(directive))
        assert.match(value, /http:\/\/asset\.localhost/)
    }
})
