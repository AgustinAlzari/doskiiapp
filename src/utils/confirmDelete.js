// Si la entidad pertenece a un proyecto que sube a la nube (cloudBackup !== false).
export function isInCloud(entity, projects) {
  if (!entity) return false
  if (typeof entity.cloudBackup === 'boolean') return entity.cloudBackup !== false
  const proj = (projects || []).find(p => p.id === entity.projectId)
  return proj ? proj.cloudBackup !== false : false
}

// Confirmación de borrado: si está en la nube, avisa que se pierde para siempre.
export function confirmDelete(label, inCloud) {
  if (inCloud) {
    return window.confirm(`"${label}" está en la nube. si lo borrás, se pierde para siempre en local y en la nube. ¿borrar de todos modos?`)
  }
  return window.confirm(`¿eliminar "${label}"?`)
}
