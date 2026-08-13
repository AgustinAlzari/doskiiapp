import { create } from 'zustand'

// Modelos de IA precargados (los más comunes). El usuario puede agregar y elegir su favorito.
export const DEFAULT_MODELS = [
  { id: 'chatgpt', name: 'chatgpt', url: 'https://chatgpt.com' },
  { id: 'gemini', name: 'gemini', url: 'https://gemini.google.com' },
  { id: 'claude', name: 'claude', url: 'https://claude.ai/new' },
]

function readStored() {
  try {
    const raw = localStorage.getItem('doski:chat')
    if (raw) return JSON.parse(raw)
  } catch {}
  return null
}

const stored = readStored() || {}
const initialModels = Array.isArray(stored.models) && stored.models.length ? stored.models : DEFAULT_MODELS

function persist(state) {
  try {
    localStorage.setItem('doski:chat', JSON.stringify({
      open: state.open,
      favoriteModelId: state.favoriteModelId,
      models: state.models,
    }))
  } catch {}
}

const useChatStore = create((set, get) => ({
  open: stored.open === true,
  models: initialModels,
  favoriteModelId: stored.favoriteModelId || initialModels[0].id,

  // Devuelve el modelo favorito (o el primero si el favorito ya no existe).
  favoriteModel: () => {
    const s = get()
    return s.models.find(m => m.id === s.favoriteModelId) || s.models[0] || null
  },

  setOpen: (open) => {
    set({ open })
    persist(get())
  },

  toggle: () => {
    get().setOpen(!get().open)
  },

  setFavorite: (id) => {
    if (!get().models.some(m => m.id === id)) return
    set({ favoriteModelId: id })
    persist(get())
  },

  addModel: ({ name, url }) => {
    const cleanName = String(name || '').trim()
    const cleanUrl = String(url || '').trim()
    if (!cleanName || !cleanUrl) return null
    const model = { id: crypto.randomUUID(), name: cleanName, url: cleanUrl }
    set(s => ({ models: [...s.models, model] }))
    persist(get())
    return model
  },

  removeModel: (id) => {
    const s = get()
    const remaining = s.models.filter(m => m.id !== id)
    if (remaining.length === 0) return
    set({
      models: remaining,
      favoriteModelId: s.favoriteModelId === id ? remaining[0].id : s.favoriteModelId,
    })
    persist(get())
  },
}))

export default useChatStore
