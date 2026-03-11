import { createEntityAdapter } from "@reduxjs/toolkit"

export const animsAdapter = createEntityAdapter({
    sortComparer: (a, b) => a.start - b.start,
})

export const {
    selectAll,
    selectById,
    selectTotal,
    selectEntities,
    selectIds
} = animsAdapter.getSelectors()

export const applyAnimProperties = (state, action) => {
    if (action.payload)
        Object.entries(action.payload).forEach(([key, value]) => {
            if (key in state && value != null && key !== "entities") state[key] = value
        })
}

export const validateAnim = anim => !(anim.end !== undefined && anim.start !== undefined && anim.end < anim.start)