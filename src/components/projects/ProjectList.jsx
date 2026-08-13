import useProjectStore from '../../store/projectStore'
import useStripStore from '../../store/stripStore'
import useCharacterStore from '../../store/characterStore'
import useBackgroundStore from '../../store/backgroundStore'
import useObjectStore from '../../store/objectStore'
import { confirmDelete, isInCloud } from '../../utils/confirmDelete'

function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`
}

export default function ProjectList({ onOpen, onNew, onEdit }) {
  const projects = useProjectStore(s => s.projects)
  const loaded = useProjectStore(s => s.loaded)
  const duplicate = useProjectStore(s => s.duplicate)
  const removeAll = useProjectStore(s => s.removeAll)
  const importFromFile = useProjectStore(s => s.importFromFile)
  const strips = useStripStore(s => s.strips)
  const characters = useCharacterStore(s => s.characters)
  const backgrounds = useBackgroundStore(s => s.backgrounds)
  const objects = useObjectStore(s => s.objects)

  const counts = (projectId) => ({
    strips: strips.filter(s => s.projectId === projectId).length,
    chars: characters.filter(c => c.projectId === projectId).length,
    bgs: backgrounds.filter(b => b.projectId === projectId).length,
    objs: objects.filter(o => o.projectId === projectId).length,
  })

  const handleImport = async () => {
    if (!window.api?.dialog || !window.api?.projects) return
    const result = await window.api.dialog.open({ filters: [{ name: 'proyecto doski', extensions: ['doski'] }] })
    if (!result.canceled && result.filePaths?.[0]) {
      const proj = await importFromFile(result.filePaths[0])
      if (proj) onOpen(proj.id)
    }
  }

  if (!loaded) return <div style={{ color: 'var(--color-text-muted)', padding: 24 }}>cargando...</div>

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 className="ui-h1">proyectos</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={handleImport}>importar .doski</button>
          <button className="btn btn-primary" onClick={onNew}>nuevo proyecto</button>
        </div>
      </div>

      {projects.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '64px 24px' }}>
          <div style={{ color: 'var(--color-text-muted)', fontSize: 14, textAlign: 'center' }}>
            sin proyectos aún. creá uno para empezar.
          </div>
          <button className="btn btn-primary" onClick={onNew}>nuevo proyecto</button>
        </div>
      ) : (
        <div className="entity-grid">
          {projects.map(project => {
            const c = counts(project.id)
            return (
              <div key={project.id} className="entity-card" onClick={() => onOpen(project.id)}>
                <div className="ui-h3">
                  {project.name}
                </div>
                {project.synopsis && (
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {project.synopsis}
                  </div>
                )}
                {project.drawingStyle && (
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                    {project.drawingStyle}
                  </div>
                )}
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
                  {c.strips} viñetas · {c.chars} personajes · {c.bgs} fondos · {c.objs} objetos
                  {project.updatedAt && <> · modif. {formatDate(project.updatedAt)}</>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: 8 }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {(project.palette || []).filter(color => color.hex).slice(0, 5).map(color => (
                      <div key={color.id} style={{ width: 14, height: 14, borderRadius: 3, background: color.hex, border: '1px solid var(--color-border)' }} title={color.label || color.hex} />
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
                    <button className="btn btn-ghost btn-sm" onClick={() => onEdit(project)} title="editar">edit</button>
                    <button className="btn btn-ghost btn-sm" onClick={async () => { const copy = await duplicate(project.id); if (copy) onEdit(copy) }} title="duplicar">⧉</button>
                    <button
                      className="btn btn-ghost btn-sm btn-danger"
                      onClick={async () => {
                        if (confirmDelete(project.name, isInCloud(project, projects))) { await removeAll(project.id); onEdit(null) }
                      }}
                    >
                      ×
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
