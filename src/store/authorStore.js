import { create } from 'zustand'

const useAuthorStore = create((set) => ({
  authors: [],
  loaded: false,

  load: async () => {
    try {
      if (!window.api?.authors) { set({ loaded: true }); return }
      const authors = await window.api.authors.list()
      set({ authors: authors || [], loaded: true })
    } catch (e) {
      console.error('Error loading authors:', e)
      set({ loaded: true })
    }
  },

  save: async (author) => {
    const updated = {
      ...author,
      id: author.id || crypto.randomUUID(),
      createdAt: author.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    if (window.api?.authors) await window.api.authors.save(updated)
    set(state => {
      const idx = state.authors.findIndex(a => a.id === updated.id)
      if (idx >= 0) {
        const next = [...state.authors]
        next[idx] = updated
        return { authors: next }
      }
      return { authors: [...state.authors, updated] }
    })
    return updated
  },

  remove: async (id) => {
    if (window.api?.authors) await window.api.authors.delete(id)
    set(state => ({ authors: state.authors.filter(a => a.id !== id) }))
  },
}))

export default useAuthorStore
