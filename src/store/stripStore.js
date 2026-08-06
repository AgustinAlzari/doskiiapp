import { create } from 'zustand'

const useStripStore = create((set) => ({
  strips: [],
  loaded: false,

  load: async () => {
    try {
      if (!window.api) { set({ loaded: true }); return }
      const strips = await window.api.strips.list()
      set({ strips: (strips || []).sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)), loaded: true })
    } catch (e) {
      console.error('Error loading strips:', e)
      set({ loaded: true })
    }
  },

  save: async (strip) => {
    const updated = { ...strip, updatedAt: new Date().toISOString() }
    if (window.api) await window.api.strips.save(updated)
    set(state => {
      const idx = state.strips.findIndex(s => s.id === updated.id)
      if (idx >= 0) {
        const next = [...state.strips]
        next[idx] = updated
        return { strips: next }
      }
      return { strips: [updated, ...state.strips] }
    })
    return updated
  },

  remove: async (id) => {
    if (window.api) await window.api.strips.delete(id)
    set(state => ({ strips: state.strips.filter(s => s.id !== id) }))
  },
}))

export default useStripStore
