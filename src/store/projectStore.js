import { create } from 'zustand'
import useCharacterStore from './characterStore'
import useStripStore from './stripStore'
import useBackgroundStore from './backgroundStore'
import useObjectStore from './objectStore'
import useBalloonStore from './balloonStore'
import useAuthorStore from './authorStore'
import usePaletteStore from './paletteStore'
import { ensureWildcards } from '../data/wildcards'

export const PALETTE_ROLES = [
  { id: 'line', label: 'línea / tinta' },
  { id: 'paper', label: 'papel / fondo' },
  { id: 'accent', label: 'acento' },
  { id: 'shadow', label: 'sombra' },
  { id: 'other', label: 'otro' },
]

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
  previewGeneral: true,
  generalNote: '',
  colorMode: 'bw',
  palette: [],
  paletteId: null,
  authorId: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
      savedAt: new Date().toISOString(),
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
      savedAt: new Date().toISOString(),
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
    // Ids robustos: si falta o es inválido, regenerar uuid.
    const ensureValidIds = async (store, key) => {
      for (const item of store.getState()[key] || []) {
        if (!item.id || typeof item.id !== 'string' || item.id.length < 8) {
          await store.getState().save({ ...item, id: crypto.randomUUID() })
        }
      }
    }
    await ensureValidIds(useProjectStore, 'projects')
    await ensureValidIds(useCharacterStore, 'characters')
    await ensureValidIds(useBackgroundStore, 'backgrounds')
    await ensureValidIds(useObjectStore, 'objects')
    await ensureValidIds(useBalloonStore, 'balloons')
    await ensureValidIds(useStripStore, 'strips')
    await ensureValidIds(useAuthorStore, 'authors')
    await ensureValidIds(usePaletteStore, 'palettes')
    await migrate(useCharacterStore, 'characters')
    await migrate(useBackgroundStore, 'backgrounds')
    await migrate(useObjectStore, 'objects')
    await migrate(useBalloonStore, 'balloons')
    await migrate(useStripStore, 'strips')
    // Viñetas multi-cuadro → un solo cuadro (el primero). Los cuadros extra se pierden.
    for (const strip of useStripStore.getState().strips || []) {
      const panels = strip.panels || []
      if (panels.length !== 1) {
        await useStripStore.getState().save({
          ...strip,
          panels: panels.slice(0, 1),
          panelCount: 1,
        })
      }
    }
    for (const project of get().projects) {
      if (project.balloons) {
        const { balloons, ...rest } = project
        await get().save(rest)
      }
    }
    await ensureWildcards(get().projects)
  },
}))

export default useProjectStore
