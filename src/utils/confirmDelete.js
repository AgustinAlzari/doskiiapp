import useConfirmStore from '../store/confirmStore'

// Si la entidad pertenece a un proyecto que sube a la nube (cloudBackup !== false).
export function isInCloud(entity, projects) {
  if (!entity) return false
  if (typeof entity.cloudBackup === 'boolean') return entity.cloudBackup !== false
  const proj = (projects || []).find(p => p.id === entity.projectId)
  return proj ? proj.cloudBackup !== false : false
}

// Confirmación de borrado (modal propio, respeta la estética de la app):
// si está en la nube, avisa que se pierde para siempre. Resuelve true si confirma.
export function confirmDelete(label, inCloud) {
  const message = inCloud
    ? `"${label}" está en la nube. si lo borrás, se pierde para siempre en local y en la nube. ¿borrar de todos modos?`
    : `¿eliminar "${label}"?`
  return useConfirmStore.getState().ask(message, { confirmLabel: 'borrar' })
}
