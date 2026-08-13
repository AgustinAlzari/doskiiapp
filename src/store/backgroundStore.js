import { create } from 'zustand'

const useBackgroundStore = create((set) => ({
  backgrounds: [],
  loaded: false,

  load: async () => {
    try {
      if (!window.api) { set({ loaded: true }); return }
      const items = await window.api.backgrounds.list()
      set({ backgrounds: items || [], loaded: true })
    } catch (e) {
      console.error('Error loading backgrounds:', e)
      set({ loaded: true })
    }
  },

  save: async (background) => {
    const updated = {
      ...background,
      id: background.id || crypto.randomUUID(),
      createdAt: background.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      savedAt: new Date().toISOString(),
    }
    if (window.api) await window.api.backgrounds.save(updated)
    set(state => {
      const idx = state.backgrounds.findIndex(b => b.id === updated.id)
      if (idx >= 0) {
        const next = [...state.backgrounds]
        next[idx] = updated
        return { backgrounds: next }
      }
      return { backgrounds: [...state.backgrounds, updated] }
    })
    return updated
  },

  remove: async (id) => {
    if (window.api) await window.api.backgrounds.delete(id)
    set(state => ({ backgrounds: state.backgrounds.filter(b => b.id !== id) }))
  },
}))

export default useBackgroundStore
