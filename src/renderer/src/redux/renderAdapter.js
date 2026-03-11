import { createEntityAdapter } from "@reduxjs/toolkit"

export const renderAdapter = createEntityAdapter({
    sortComparer: (a, b) => a.timestamp - b.timestamp,
})

export const {
    selectAll,
    selectById,
    selectTotal,
    selectEntities
} = renderAdapter.getSelectors()
