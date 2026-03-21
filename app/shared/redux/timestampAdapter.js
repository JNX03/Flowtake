import { createEntityAdapter } from "@reduxjs/toolkit"

export const timestampAdapter = createEntityAdapter({
    selectId: ({ t }) => t,
    sortComparer: (a, b) => a.t - b.t,
})

export const {
    selectAll,
    selectById,
    selectTotal,
    selectIds
} = timestampAdapter.getSelectors()

export const applyTimestampProperties = (state, action) => {
    if (action.payload)
        Object.entries(action.payload).forEach(([key, value]) => {
            if (key in state && value != null && key !== "entities") state[key] = value
        })
}
