/**
 * Enhances an action with a group identifier for redux-undo
 * @param {Object} action - The action to enhance
 * @param {string} group - The group identifier
 * @returns {Object} - The enhanced action with meta.group
 */
export const withGroup = (action, group) => ({
    ...action,
    meta: { ...(action.meta || {}), group }
})

export const withPreventUndo = action => ({
    ...action,
    meta: { ...(action.meta || {}), preventUndo: true }
})

export const getGroup = prefix => `${prefix}-${self.crypto.randomUUID()}`