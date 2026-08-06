import { create } from 'zustand'

const useCharacterStore = create((set, get) => ({
  characters: [],
  loaded: false,

  load: async () => {
    try {
      if (!window.api) { set({ loaded: true }); return }
      const chars = await window.api.characters.list()
      set({ characters: chars || [], loaded: true })
    } catch (e) {
      console.error('Error loading characters:', e)
      set({ loaded: true })
    }
  },

  save: async (character) => {
    const updated = {
      ...character,
      id: character.id || crypto.randomUUID(),
      createdAt: character.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    if (window.api) await window.api.characters.save(updated)
    set(state => {
      const idx = state.characters.findIndex(c => c.id === updated.id)
      if (idx >= 0) {
        const next = [...state.characters]
        next[idx] = updated
        return { characters: next }
      }
      return { characters: [...state.characters, updated] }
    })
    return updated
  },

  remove: async (id) => {
    if (window.api) await window.api.characters.delete(id)
    set(state => ({ characters: state.characters.filter(c => c.id !== id) }))
  },
}))

export default useCharacterStore
