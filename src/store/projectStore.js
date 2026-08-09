import { create } from 'zustand'
import useCharacterStore from './characterStore'
import useStripStore from './stripStore'
import useBackgroundStore from './backgroundStore'
import useObjectStore from './objectStore'
import useBalloonStore from './balloonStore'
import { ensureWildcards } from '../data/wildcards'

export const PALETTE_ROLES = [
  { id: 'line', label: 'línea / tinta' },
  { id: 'paper', label: 'papel / fondo' },
  { id: 'accent', label: 'acento' },
  { id: 'shadow', label: 'sombra' },
  { id: 'other', label: 'otro' },
]

export const BALLOON_TYPES = [
  { id: 'narration', label: 'narrador', fileBase: 'globo-narrador', prompt: 'NARRATION' },
  { id: 'speech', label: 'diálogo', fileBase: 'globo-dialogo', prompt: 'DIALOGUE' },
  { id: 'thought', label: 'pensar', fileBase: 'globo-pensar', prompt: 'THOUGHT' },
  { id: 'other', label: 'globo x', fileBase: 'globo-x', prompt: 'OTHER' },
]

export const BALLOON_KIND_LABELS = {
  narration: 'narración',
  speech: 'diálogo',
  thought: 'pensamiento',
  other: 'globo x',
}

export const COLOR_MODES = [
  { id: 'bw', label: 'B&N' },
  { id: 'duotone', label: 'duotono' },
  { id: 'limited', label: 'color limitado' },
  { id: 'full', label: 'color pleno' },
]

export const makeDefaultProject = () => ({
  id: crypto.randomUUID(),
  name: 'Proyecto principal',
  synopsis: '',
  genre: '',
  drawingStyle: '',
  world: '',
  styleNotes: '',
  defaultAspectRatio: 'hd',
  defaultPanelCount: 3,
  colorMode: 'bw',
  palette: [],
  balloons: {
    narration: { entityId: null, description: '' },
    speech: { entityId: null, description: '' },
    thought: { entityId: null, description: '' },
    other: { entityId: null, description: '' },
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
})

const upsert = (list, item) => {
  const idx = list.findIndex(p => p.id === item.id)
  if (idx >= 0) {
    const next = [...list]
    next[idx] = item
    return next
  }
  return [...list, item]
}

const useProjectStore = create((set, get) => ({
  projects: [],
  loaded: false,

  load: async () => {
    try {
      let projects = []
      if (window.api?.projects) projects = await window.api.projects.list()
      projects = projects || []
      if (projects.length === 0) {
        const proj = makeDefaultProject()
        if (window.api?.projects) await window.api.projects.save(proj)
        projects = [proj]
      }
      set({ projects, loaded: true })
    } catch (e) {
      console.error('Error loading projects:', e)
      set({ loaded: true })
    }
  },

  save: async (project) => {
    const updated = {
      ...project,
      id: project.id || crypto.randomUUID(),
      createdAt: project.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    if (window.api?.projects) await window.api.projects.save(updated)
    set(state => ({ projects: upsert(state.projects, updated) }))
    await ensureWildcards([updated])
    return updated
  },

  remove: async (id) => {
    if (window.api?.projects) await window.api.projects.delete(id)
    set(state => ({ projects: state.projects.filter(p => p.id !== id) }))
  },

  removeAll: async (id) => {
    if (window.api?.projects) await window.api.projects.deleteAll(id)
    set(state => ({ projects: state.projects.filter(p => p.id !== id) }))
    await useCharacterStore.getState().load()
    await useBackgroundStore.getState().load()
    await useObjectStore.getState().load()
    await useBalloonStore.getState().load()
    await useStripStore.getState().load()
  },

  duplicate: async (id) => {
    if (!window.api?.projects) return null
    const newProject = await window.api.projects.duplicate(id)
    set(state => ({ projects: upsert(state.projects, newProject) }))
    await useCharacterStore.getState().load()
    await useBackgroundStore.getState().load()
    await useObjectStore.getState().load()
    await useBalloonStore.getState().load()
    await useStripStore.getState().load()
    await ensureWildcards(get().projects)
    return newProject
  },

  importFromFile: async (filePath) => {
    if (!window.api?.projects) return null
    const newProject = await window.api.projects.import(filePath)
    await useCharacterStore.getState().load()
    await useBackgroundStore.getState().load()
    await useObjectStore.getState().load()
    await useBalloonStore.getState().load()
    await useStripStore.getState().load()
    await ensureWildcards([newProject])
    set(state => ({ projects: upsert(state.projects, newProject) }))
    return newProject
  },

  migrate: async () => {
    const defaultId = get().projects[0]?.id
    if (!defaultId) return
    const migrate = async (store, key) => {
      const items = store.getState()[key] || []
      for (const item of items) {
        if (!item.projectId) await store.getState().save({ ...item, projectId: defaultId })
      }
    }
    await migrate(useCharacterStore, 'characters')
    await migrate(useBackgroundStore, 'backgrounds')
    await migrate(useObjectStore, 'objects')
    await migrate(useBalloonStore, 'balloons')
    await migrate(useStripStore, 'strips')
    await migrateProjectBalloonEntities(get(), useBalloonStore, BALLOON_TYPES)
    await ensureWildcards(get().projects)
  },
}))

async function migrateProjectBalloonEntities(store, balloonStore, balloonTypes) {
  for (const project of store.get().projects) {
    const balloons = project.balloons || {}
    let changed = false
    for (const kind of balloonTypes.map(t => t.id)) {
      const cfg = balloons[kind] || {}
      if (!cfg.entityId && cfg.description?.trim()) {
        const label = balloonTypes.find(t => t.id === kind)?.label || kind
        const entity = await balloonStore.getState().save({
          id: crypto.randomUUID(),
          projectId: project.id,
          name: `Globo ${label} (heredado)`,
          kind,
          text: '',
          promptText: cfg.description.trim(),
          color: '#7a7a7a',
          comodin: false,
        })
        cfg.entityId = entity.id
        changed = true
      }
    }
    if (changed) {
      await store.getState().save({ ...project, balloons })
    }
  }
}

export default useProjectStore
