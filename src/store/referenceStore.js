import { create } from 'zustand'

const useReferenceStore = create((set) => ({
  references: [],
  loaded: false,

  load: async () => {
    try {
      if (!window.api) { set({ loaded: true }); return }
      const refs = await window.api.referenceDefs.list()
      set({ references: refs || [], loaded: true })
    } catch (e) {
      console.error('Error loading references:', e)
      set({ loaded: true })
    }
  },

  save: async (reference) => {
    const updated = {
      ...reference,
      id: reference.id || crypto.randomUUID(),
      createdAt: reference.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      savedAt: new Date().toISOString(),
    }
    if (window.api) await window.api.referenceDefs.save(updated)
    set(state => {
      const idx = state.references.findIndex(r => r.id === updated.id)
      if (idx >= 0) {
        const next = [...state.references]
        next[idx] = updated
        return { references: next }
      }
      return { references: [...state.references, updated] }
    })
    return updated
  },

  remove: async (id) => {
    if (window.api) await window.api.referenceDefs.delete(id)
    set(state => ({ references: state.references.filter(r => r.id !== id) }))
  },
}))

export default useReferenceStore