import { create } from 'zustand'

export function resolvePaletteColors(project, palettes = []) {
  if (!project) return []
  if (project.paletteId) {
    const lib = (palettes || []).find(p => p.id === project.paletteId)
    if (lib?.colors?.length) return lib.colors
  }
  return project.palette || []
}

const usePaletteStore = create((set) => ({
  palettes: [],
  loaded: false,

  load: async () => {
    try {
      if (!window.api?.palettes) { set({ loaded: true }); return }
      const palettes = await window.api.palettes.list()
      set({ palettes: palettes || [], loaded: true })
    } catch (e) {
      console.error('Error loading palettes:', e)
      set({ loaded: true })
    }
  },

  save: async (palette) => {
    const updated = {
      ...palette,
      id: palette.id || crypto.randomUUID(),
      createdAt: palette.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      savedAt: new Date().toISOString(),
    }
    if (window.api?.palettes) await window.api.palettes.save(updated)
    set(state => {
      const idx = state.palettes.findIndex(p => p.id === updated.id)
      if (idx >= 0) {
        const next = [...state.palettes]
        next[idx] = updated
        return { palettes: next }
      }
      return { palettes: [...state.palettes, updated] }
    })
    return updated
  },

  remove: async (id) => {
    if (window.api?.palettes) await window.api.palettes.delete(id)
    set(state => ({ palettes: state.palettes.filter(p => p.id !== id) }))
  },
}))

export default usePaletteStore
