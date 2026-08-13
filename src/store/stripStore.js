import { create } from 'zustand'

const useStripStore = create((set, get) => ({
  strips: [],
  loaded: false,

  load: async () => {
    try {
      if (!window.api) { set({ loaded: true }); return }
      const strips = await window.api.strips.list()
      // Orden del proyecto primero (position), el resto por actualización reciente.
      const sorted = (strips || []).sort((a, b) => {
        const pa = a.position == null ? Infinity : a.position
        const pb = b.position == null ? Infinity : b.position
        if (pa !== pb) return pa - pb
        return new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)
      })
      set({ strips: sorted, loaded: true })
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

  // Persiste el orden de las viñetas de un proyecto (no toca updatedAt).
  reorder: async (projectId, orderedIds) => {
    const updated = get().strips.map(s =>
      s.projectId === projectId ? { ...s, position: orderedIds.indexOf(s.id) } : s
    )
    const sorted = [...updated].sort((a, b) => {
      const pa = a.position == null ? Infinity : a.position
      const pb = b.position == null ? Infinity : b.position
      if (pa !== pb) return pa - pb
      return new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)
    })
    set({ strips: sorted })
    const targets = updated.filter(s => s.projectId === projectId)
    if (window.api?.strips?.save) {
      await Promise.all(targets.map(s => window.api.strips.save(s)))
    }
    return targets
  },
}))

export default useStripStore
