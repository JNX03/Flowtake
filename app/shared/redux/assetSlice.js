import { createEntityAdapter, createSelector, createSlice } from '@reduxjs/toolkit'

const assetsAdapter = createEntityAdapter()

const initialState = assetsAdapter.getInitialState({
    isImporting: false,
    // Built-in asset templates
    builtInAssets: [
        { id: "builtin-text-title", name: "Title", type: "text", category: "text", config: { text: "Title", fontSize: 48, fontWeight: 600, color: "#ffffff" } },
        { id: "builtin-text-subtitle", name: "Subtitle", type: "text", category: "text", config: { text: "Subtitle", fontSize: 32, fontWeight: 400, color: "#cccccc" } },
        { id: "builtin-text-caption", name: "Caption", type: "text", category: "text", config: { text: "Caption", fontSize: 24, fontWeight: 400, color: "#ffffff" } },
        { id: "builtin-text-callout", name: "Callout", type: "text", category: "text", config: { text: "Important!", fontSize: 36, fontWeight: 600, color: "#ff6b6b" } },
        { id: "builtin-shape-rect", name: "Rectangle", type: "shape", category: "shapes", config: { shapeType: "rect", fill: "#6C5CE7", stroke: "none", width: 200, height: 100, borderRadius: 8 } },
        { id: "builtin-shape-circle", name: "Circle", type: "shape", category: "shapes", config: { shapeType: "circle", fill: "#E84393", stroke: "none", radius: 60 } },
        { id: "builtin-shape-rounded", name: "Pill", type: "shape", category: "shapes", config: { shapeType: "rect", fill: "#00CEC9", stroke: "none", width: 240, height: 60, borderRadius: 30 } },
        { id: "builtin-shape-outline", name: "Frame", type: "shape", category: "shapes", config: { shapeType: "rect", fill: "none", stroke: "#ffffff", strokeWidth: 3, width: 200, height: 150, borderRadius: 4 } },
        { id: "builtin-shape-arrow", name: "Arrow", type: "shape", category: "shapes", config: { shapeType: "arrow", fill: "#55efc4", stroke: "none", width: 150, height: 40 } },
        { id: "builtin-shape-badge", name: "Badge", type: "shape", category: "shapes", config: { shapeType: "circle", fill: "#ff6b6b", stroke: "none", radius: 24 } },
    ]
})

export const assetSlice = createSlice({
    name: 'assets',
    initialState,
    reducers: {
        reset: () => initialState,
        addAsset: {
            reducer: (state, action) => assetsAdapter.addOne(state, action),
            prepare: asset => ({
                payload: {
                    ...asset,
                    createdAt: asset.createdAt ?? Date.now(),
                }
            }),
        },
        removeAsset: assetsAdapter.removeOne,
        removeAssets: assetsAdapter.removeMany,
        updateAsset: assetsAdapter.updateOne,
        setAssets: assetsAdapter.setAll,
        setIsImporting: (state, action) => { state.isImporting = action.payload },
    },
})

export const {
    reset,
    addAsset,
    removeAsset,
    removeAssets,
    updateAsset,
    setAssets,
    setIsImporting,
} = assetSlice.actions

const { selectAll, selectById, selectIds, selectTotal } = assetsAdapter.getSelectors()

export const selectAllAssets = state => selectAll(state.assets)
export const selectAssetById = (state, id) => selectById(state.assets, id)
export const selectAssetIds = state => selectIds(state.assets)
export const selectTotalAssets = state => selectTotal(state.assets)
export const selectIsImporting = state => state.assets.isImporting
export const selectBuiltInAssets = state => state.assets.builtInAssets
export const selectAssetsByCategory = (state, category) =>
    selectAll(state.assets).filter(a => a.category === category)
export const selectBuiltInAssetsByCategory = (state, category) =>
    state.assets.builtInAssets.filter(a => a.category === category)

const selectLibraryCategory = (_state, category) => category
const selectLibraryQuery = (_state, _category, query = "") => query
const selectLibrarySort = (_state, _category, _query, sortBy = "newest") => sortBy

function getAssetTimestamp(asset) {
    const explicitTimestamp = Number(asset.createdAt ?? asset.updatedAt ?? asset.modifiedAt)
    if (Number.isFinite(explicitTimestamp)) return explicitTimestamp

    const idTimestamp = String(asset.id).match(/(?:import|audio)-(\d{10,})/)
    return idTimestamp ? Number(idTimestamp[1]) : 0
}

function compareAssetNames(left, right) {
    return String(left.name || "").localeCompare(String(right.name || ""), undefined, {
        numeric: true,
        sensitivity: "base",
    })
}

/**
 * Creates an independently memoized selector for a media-library surface.
 * Keep one selector instance per mounted panel so search and sort do not
 * allocate a new result array during unrelated editor updates.
 */
export const makeSelectLibraryAssets = () => createSelector(
    [selectAllAssets, selectLibraryCategory, selectLibraryQuery, selectLibrarySort],
    (assets, category, query, sortBy) => {
        const normalizedQuery = String(query || "").trim().toLocaleLowerCase()
        const filteredAssets = assets.filter(asset => {
            if (category && asset.category !== category) return false
            if (!normalizedQuery) return true

            return [asset.name, asset.type, asset.mimeType, asset.category]
                .some(value => String(value || "").toLocaleLowerCase().includes(normalizedQuery))
        })

        return filteredAssets.slice().sort((left, right) => {
            if (sortBy === "name") return compareAssetNames(left, right)
            if (sortBy === "type") {
                return String(left.type || "").localeCompare(String(right.type || ""), undefined, {
                    sensitivity: "base",
                }) || compareAssetNames(left, right)
            }

            return getAssetTimestamp(right) - getAssetTimestamp(left)
                || compareAssetNames(left, right)
        })
    }
)

export default assetSlice.reducer
