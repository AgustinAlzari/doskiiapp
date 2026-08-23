import { create } from 'zustand'

// Id reservado de una tira por defecto del proyecto (determinista → nunca se duplica).
export const defaultTiraId = (projectId, kind) => `${kind}-${projectId}`

// Es una tira por defecto del proyecto: "borrador" (y "general" si algún día
// existe como tira). No se pueden borrar ni duplicar vía nube o importación.
export function isDefaultTira(t) {
  if (!t) return false
  if (t.default === true) return true
  const id = String(t.id || '')
  if (/^(borrador|general)-/.test(id)) return true
  const title = String(t.title || '').toLowerCase()
  return title === 'borrador' || title === 'general'
}

const useTiraStore = create((set, get) => ({
  tiras: [],
  loaded: false,

  load: async () => {
    try {
      if (!window.api) { set({ loaded: true }); return }
      const tiras = await window.api.tiras.list()
      const sorted = (tiras || []).sort((a, b) => {
        const pa = a.position == null ? Infinity : a.position
        const pb = b.position == null ? Infinity : b.position
        if (pa !== pb) return pa - pb
        return new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)
      })
      set({ tiras: sorted, loaded: true })
    } catch (e) {
      console.error('Error loading tiras:', e)
      set({ loaded: true })
    }
  },

  save: async (tira) => {
    const updated = { ...tira, updatedAt: new Date().toISOString(), savedAt: new Date().toISOString() }
    if (window.api) await window.api.tiras.save(updated)
    set(state => {
      const idx = state.tiras.findIndex(t => t.id === updated.id)
      if (idx >= 0) {
        const next = [...state.tiras]
        next[idx] = updated
        return { tiras: next }
      }
      return { tiras: [updated, ...state.tiras] }
    })
    return updated
  },

  remove: async (id) => {
    if (window.api) await window.api.tiras.delete(id)
    set(state => ({ tiras: state.tiras.filter(t => t.id !== id) }))
  },

  create: async (projectId, title, id) => {
    const tira = {
      id: id || crypto.randomUUID(),
      projectId,
      title: title || 'tira',
      stripIds: [],
      showInPreview: false,
      notes: '',
      position: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      savedAt: new Date().toISOString(),
    }
    return get().save(tira)
  },

  // Persiste el orden de las tiras de un proyecto (no toca updatedAt).
  reorder: async (projectId, orderedIds) => {
    const updated = get().tiras.map(t =>
      t.projectId === projectId ? { ...t, position: orderedIds.indexOf(t.id) } : t
    )
    const sorted = [...updated].sort((a, b) => {
      const pa = a.position == null ? Infinity : a.position
      const pb = b.position == null ? Infinity : b.position
      if (pa !== pb) return pa - pb
      return new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)
    })
    set({ tiras: sorted })
    const targets = updated.filter(t => t.projectId === projectId)
    if (window.api?.tiras?.save) {
      await Promise.all(targets.map(t => window.api.tiras.save(t)))
    }
    return targets
  },

  // Asegura que el proyecto tenga su tira "borrador" por defecto. El id es
  // determinista (`borrador-<projectId>`) para que abrir un proyecto jamás cree
  // una copia: migra las "borrador" viejas (id random) al id reservado y borra
  // los sobrantes. La tira por defecto queda marcada `default: true` y la app
  // (y el backup) la protegen de borrado/duplicación.
  ensureDefault: async (projectId) => {
    if (!projectId) return
    const reservedId = defaultTiraId(projectId, 'borrador')
    const legacy = get().tiras
      .filter(t => t.projectId === projectId && t.title === 'borrador' && t.id !== reservedId)
      .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0))
    for (const extra of legacy.slice(1)) {
      await get().remove(extra.id)
    }
    const main = legacy[0]
    if (main) {
      await get().save({ ...main, id: reservedId, default: true })
      await get().remove(main.id)
    }
    const exists = get().tiras.some(t => t.projectId === projectId && t.id === reservedId)
    if (!exists) await get().create(projectId, 'borrador', reservedId)
  },
}))

export default useTiraStore
