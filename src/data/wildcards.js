import useCharacterStore from '../store/characterStore'
import useBackgroundStore from '../store/backgroundStore'
import useObjectStore from '../store/objectStore'

export const WILDCARD_DEFS = [
  { type: 'character', name: 'Personaje X', color: '#8e8e93' },
  { type: 'background', name: 'Paisaje X', color: '#8e8e93' },
  { type: 'object', name: 'Objeto X', color: '#8e8e93' },
]

const WILDCARD_COLORS = {
  character: '#8e8e93',
  background: '#8e8e93',
  object: '#8e8e93',
}

const WILDCARD_NAMES = {
  character: 'Personaje X',
  background: 'Paisaje X',
  object: 'Objeto X',
}

const STORE_BY_TYPE = {
  character: useCharacterStore,
  background: useBackgroundStore,
  object: useObjectStore,
}

const LIST_KEY_BY_TYPE = {
  character: 'characters',
  background: 'backgrounds',
  object: 'objects',
}

export function makeWildcard(type, projectId) {
  return {
    id: crypto.randomUUID(),
    projectId,
    name: WILDCARD_NAMES[type] || `comodín ${type}`,
    color: WILDCARD_COLORS[type] || '#8e8e93',
    promptText: '',
    referenceImages: [],
    comodin: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

export async function ensureWildcards(projects = []) {
  for (const project of projects) {
    for (const def of WILDCARD_DEFS) {
      const store = STORE_BY_TYPE[def.type]
      if (!store) continue
      const list = store.getState()[LIST_KEY_BY_TYPE[def.type]] || []
      const existing = list.find(item => item.projectId === project.id && item.comodin)
      if (existing) {
        if (existing.name !== def.name || existing.color !== def.color) {
          await store.getState().save({ ...existing, name: def.name, color: def.color })
        }
      } else {
        await store.getState().save(makeWildcard(def.type, project.id))
      }
    }
  }
}
