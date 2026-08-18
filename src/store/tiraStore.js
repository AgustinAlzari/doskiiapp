import { create } from 'zustand'

const useTiraStore = create((set, get) => ({
  tiras: [],
  loaded: false,

  load: async () => {
    try {
      if (!window.api) { set({ loaded: true }); return }
      const tiras = await window.api.tiras.list()
      const sorted = (tiras || []).sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
      set({ tiras: sorted, loaded: true })
    } catch (e) {
      console.error('Error loading tiras:', e)
      set({ loaded: true })
    }
  },

  save: async (tira) => {
    const updated = { ...tira, updatedAt: new Date().toISOString(), savedAt: new Date().toISOString() }
    if (window.api) await window.api.tiras.save(updated)
    set(state => {
      const idx = state.tiras.findIndex(t => t.id === updated.id)
      if (idx >= 0) {
        const next = [...state.tiras]
        next[idx] = updated
        return { tiras: next }
      }
      return { tiras: [updated, ...state.tiras] }
    })
    return updated
  },

  remove: async (id) => {
    if (window.api) await window.api.tiras.delete(id)
    set(state => ({ tiras: state.tiras.filter(t => t.id !== id) }))
  },

  create: async (projectId, title) => {
    const tira = {
      id: crypto.randomUUID(),
      projectId,
      title: title || 'tira',
      stripIds: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      savedAt: new Date().toISOString(),
    }
    return get().save(tira)
  },
}))

export default useTiraStore
