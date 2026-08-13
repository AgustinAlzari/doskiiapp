import { create } from 'zustand'

const useObjectStore = create((set) => ({
  objects: [],
  loaded: false,

  load: async () => {
    try {
      if (!window.api) { set({ loaded: true }); return }
      const items = await window.api.objects.list()
      set({ objects: items || [], loaded: true })
    } catch (e) {
      console.error('Error loading objects:', e)
      set({ loaded: true })
    }
  },

  save: async (obj) => {
    const updated = {
      ...obj,
      id: obj.id || crypto.randomUUID(),
      createdAt: obj.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      savedAt: new Date().toISOString(),
    }
    if (window.api) await window.api.objects.save(updated)
    set(state => {
      const idx = state.objects.findIndex(o => o.id === updated.id)
      if (idx >= 0) {
        const next = [...state.objects]
        next[idx] = updated
        return { objects: next }
      }
      return { objects: [...state.objects, updated] }
    })
    return updated
  },

  remove: async (id) => {
    if (window.api) await window.api.objects.delete(id)
    set(state => ({ objects: state.objects.filter(o => o.id !== id) }))
  },
}))

export default useObjectStore
