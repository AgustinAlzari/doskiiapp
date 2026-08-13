import { create } from 'zustand'
import { makeDefaultBalloonLaws } from '../data/balloonLaws'

const useBalloonStore = create((set) => ({
  balloons: [],
  loaded: false,

  load: async () => {
    try {
      if (!window.api) { set({ loaded: true }); return }
      const balloons = await window.api.balloons.list()
      set({ balloons: balloons || [], loaded: true })
    } catch (e) {
      console.error('Error loading balloons:', e)
      set({ loaded: true })
    }
  },

  save: async (balloon) => {
    const updated = {
      ...balloon,
      id: balloon.id || crypto.randomUUID(),
      laws: { ...makeDefaultBalloonLaws(), ...(balloon.laws || {}) },
      createdAt: balloon.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      savedAt: new Date().toISOString(),
    }
    if (window.api) await window.api.balloons.save(updated)
    set(state => {
      const idx = state.balloons.findIndex(b => b.id === updated.id)
      if (idx >= 0) {
        const next = [...state.balloons]
        next[idx] = updated
        return { balloons: next }
      }
      return { balloons: [...state.balloons, updated] }
    })
    return updated
  },

  remove: async (id) => {
    if (window.api) await window.api.balloons.delete(id)
    set(state => ({ balloons: state.balloons.filter(b => b.id !== id) }))
  },
}))

export default useBalloonStore
