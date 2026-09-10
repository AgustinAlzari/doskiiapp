import { create } from 'zustand'

// Modelos de IA precargados (los más comunes). El usuario puede agregar y elegir su favorito.
// 10 mejores con soporte de img de referencia + chat para generar (estilo gemini/chatgpt) — gratuitos/open cuando existe
// nota: las fichas de huggingface.co/<model> no son chats y no admiten "enviar al chat" (autopaste necesita un composer).
// por eso se reemplazaron por chats reales con generación de imagen + visión (ref).
export const DEFAULT_MODELS = [
  { id: 'chatgpt', name: 'chatgpt', url: 'https://chatgpt.com' },
  { id: 'gemini', name: 'gemini', url: 'https://gemini.google.com' },
  { id: 'claude', name: 'claude', url: 'https://claude.ai/new' },
  { id: 'muse-image', name: 'muse imagen', url: 'https://www.meta.ai/' },
  { id: 'qwen-image', name: 'qwen imagen', url: 'https://chat.qwen.ai/?inputFeature=t2i' },
  { id: 'grok', name: 'grok', url: 'https://grok.com' },
  { id: 'copilot', name: 'copilot', url: 'https://copilot.microsoft.com' },
  { id: 'huggingchat', name: 'huggingchat', url: 'https://huggingface.co/chat' },
  { id: 'poe', name: 'poe', url: 'https://poe.com' },
  { id: 'perplexity', name: 'perplexity', url: 'https://www.perplexity.ai' },
]

// ids y urls viejas de huggingface (fichas, no chats) — se migran/eliminan automáticamente
const DEPRECATED_IDS = new Set(['flux2', 'ernie-image', 'hunyuan', 'joyai', 'longcat', 'hidream', 'kolors', 'glm-image'])
const DEPRECATED_URL_RE = /huggingface\.co\/(black-forest-labs|baidu\/ERNIE|tencent\/Hunyuan|jd-opensource\/JoyAI|meituan-longcat|HiDream-ai|Kwai-Kolors|zai-org\/GLM)/i

function isDeprecatedModel(m) {
  if (!m) return false
  if (DEPRECATED_IDS.has(String(m.id))) return true
  if (DEPRECATED_URL_RE.test(String(m.url || ''))) return true
  // ficha genérica hf sin /chat ni /spaces (no es chat ni playground) — no sirve para autopaste
  const u = String(m.url || '')
  if (/^https:\/\/huggingface\.co\/[^\/]+\/[^\/]+$/.test(u) && !u.includes('/chat') && !u.includes('/spaces')) return true
  return false
}

function readStored() {
  try {
    const raw = localStorage.getItem('doski:chat')
    if (raw) return JSON.parse(raw)
  } catch {}
  return null
}

const stored = readStored() || {}
const initialModels = (() => {
  if (!Array.isArray(stored.models) || !stored.models.length) return DEFAULT_MODELS
  // migración: filtrar fichas hf viejas que no son chats (no tienen composer)
  let cleaned = stored.models.filter(m => !isDeprecatedModel(m))
  const wasCleaned = cleaned.length !== stored.models.length
  if (!cleaned.length) cleaned = [...DEFAULT_MODELS]
  else {
    const existingIds = new Set(cleaned.map(m => m.id))
    const existingNames = new Set(cleaned.map(m => String(m.name).toLowerCase()))
    const missing = DEFAULT_MODELS.filter(m => !existingIds.has(m.id) && !existingNames.has(String(m.name).toLowerCase()))
    if (missing.length) cleaned = [...cleaned, ...missing]
  }
  // si se limpió, persistir en próximo tick (evita escribir durante init si no hay window)
  if (wasCleaned) {
    try {
      const fav = stored.favoriteModelId && cleaned.some(m => m.id === stored.favoriteModelId) ? stored.favoriteModelId : cleaned[0]?.id
      localStorage.setItem('doski:chat', JSON.stringify({ open: stored.open, favoriteModelId: fav, models: cleaned }))
      stored.models = cleaned
      stored.favoriteModelId = fav
    } catch {}
  }
  return cleaned
})()

// favorito efectivo tras migración
const initialFavoriteId = (() => {
  const fav = stored.favoriteModelId
  if (fav && initialModels.some(m => m.id === fav)) return fav
  return initialModels[0]?.id || null
})()

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
  favoriteModelId: initialFavoriteId || initialModels[0]?.id,

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
