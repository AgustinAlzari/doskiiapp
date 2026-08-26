import { create } from 'zustand'

// Recuerda, por proyecto y para la sesión actual, qué tiras están seleccionadas
// en "preview y export". Así al navegar a otra pantalla y volver, se restaura la
// última selección (no se fuerza "general"). La memoria es de la sesión: no se
// persiste en disco, pero sí sobrevive a los cambios de vista dentro del SPA.
const usePreviewStore = create((set, get) => ({
  selectionByProject: {},
  getSelection: (projectId) => get().selectionByProject[projectId] || null,
  setSelection: (projectId, ids) => {
    if (!projectId) return
    set(state => ({ selectionByProject: { ...state.selectionByProject, [projectId]: ids } }))
  },
}))

export default usePreviewStore
