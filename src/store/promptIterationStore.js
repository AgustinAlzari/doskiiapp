import { create } from 'zustand'

function makeIteration({ promptText, refs, imageDataUrl, imagePath, responseId, usage, model, reasoning }) {
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    promptText,
    refs,
    imageDataUrl,
    imagePath,
    responseId,
    usage,
    model,
    reasoning,
  }
}

const usePromptIterationStore = create((set, get) => ({
  byPanel: {},

  ensurePanel: (stripId, panelId) => {
    const key = `${stripId}:${panelId}`
    if (get().byPanel[key]) return
    set((s) => ({
      byPanel: {
        ...s.byPanel,
        [key]: {
          scene: { iterations: [], currentId: null, approvedId: null },
          dialogs: { iterations: [], currentId: null, approvedId: null },
          museConversation: { firstResponseId: null, lastResponseId: null, usageTotals: null },
        },
      },
    }))
  },

  getPanel: (stripId, panelId) => {
    const key = `${stripId}:${panelId}`
    return get().byPanel[key] || null
  },

  addSceneIteration: (stripId, panelId, data) => {
    const key = `${stripId}:${panelId}`
    get().ensurePanel(stripId, panelId)
    const entry = get().byPanel[key]
    const it = makeIteration(data)
    const nextScene = { iterations: [...entry.scene.iterations, it], currentId: it.id, approvedId: entry.scene.approvedId }
    const nextMuse = { ...entry.museConversation }
    if (!nextMuse.firstResponseId && data.responseId) nextMuse.firstResponseId = data.responseId
    if (data.responseId) nextMuse.lastResponseId = data.responseId
    set((s) => ({
      byPanel: {
        ...s.byPanel,
        [key]: { ...entry, scene: nextScene, museConversation: nextMuse },
      },
    }))
    return it
  },

  setCurrent: (stripId, panelId, mode, id) => {
    const key = `${stripId}:${panelId}`
    const entry = get().byPanel[key]
    if (!entry) return
    set((s) => ({
      byPanel: {
        ...s.byPanel,
        [key]: { ...entry, [mode]: { ...entry[mode], currentId: id } },
      },
    }))
  },

  approve: (stripId, panelId, mode, id) => {
    const key = `${stripId}:${panelId}`
    const entry = get().byPanel[key]
    if (!entry) return
    set((s) => ({
      byPanel: {
        ...s.byPanel,
        [key]: { ...entry, [mode]: { ...entry[mode], approvedId: id, currentId: id } },
      },
    }))
  },

  migrateFromStrip: (strip) => {
    if (!strip || !strip.id || !Array.isArray(strip.panels)) return
    for (let idx = 0; idx < strip.panels.length; idx++) {
      const panel = strip.panels[idx]
      const key = `${strip.id}:${panel.id}`
      if (get().byPanel[key]?.scene.iterations.length) continue
      const results = strip.results || []
      const coverIdx = strip.resultCoverIndex ?? -1
      if (!results.length) continue
      for (let i = 0; i < results.length; i++) {
        const r = results[i]
        get().addSceneIteration(strip.id, panel.id, {
          promptText: '(migrado)',
          refs: [],
          imagePath: r.path,
          imageDataUrl: null,
          responseId: null,
          usage: null,
          model: 'migrado',
        })
      }
      if (coverIdx >= 0 && results[coverIdx]) {
        const entry = get().byPanel[key]
        const it = entry.scene.iterations[coverIdx]
        if (it) get().approve(strip.id, panel.id, 'scene', it.id)
      }
    }
  },
}))

export default usePromptIterationStore
