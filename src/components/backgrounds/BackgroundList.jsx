import { useEffect, useState } from 'react'
import useBackgroundStore from '../../store/backgroundStore'
import useProjectStore from '../../store/projectStore'

function BackgroundThumb({ referenceImages }) {
  const [preview, setPreview] = useState(null)
  const ref = referenceImages?.[0]

  useEffect(() => {
    let active = true
    if (ref?.path && window.api?.references) {
      window.api.references.read(ref.path).then(url => { if (active) setPreview(url) })
    } else setPreview(null)
    return () => { active = false }
  }, [ref?.path])

  if (preview) {
    return <img src={preview} alt="" className="entity-card-thumb" />
  }
  return <div className="entity-card-thumb entity-card-thumb-empty" />
}

export default function BackgroundList({ projectId, onNew, onEdit }) {
  const backgrounds = useBackgroundStore(s => s.backgrounds)
  const loaded = useBackgroundStore(s => s.loaded)
  const remove = useBackgroundStore(s => s.remove)
  const save = useBackgroundStore(s => s.save)
  const projects = useProjectStore(s => s.projects)
  const scoped = backgrounds.filter(b => b.projectId === projectId)

  const copyToProject = async (bg, targetId) => {
    await save({
      ...bg,
      id: crypto.randomUUID(),
      projectId: targetId,
      createdAt: new Date().toISOString(),
    })
  }

  if (!loaded) return <div style={{ color: 'var(--color-text-muted)', padding: 24 }}>cargando...</div>

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}>fondos</h1>
        <button className="btn btn-primary" onClick={onNew}>nuevo fondo</button>
      </div>

      {scoped.length === 0 ? (
        <div style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
          sin fondos aún. crea uno para empezar.
        </div>
      ) : (
        <div className="entity-grid">
          {scoped.map(bg => (
            <div
              key={bg.id}
              className="entity-card"
              onClick={() => onEdit(bg)}
            >
              <BackgroundThumb referenceImages={bg.referenceImages} />
              <div style={{ fontWeight: 600, fontSize: 15, lineHeight: 1.3 }}>
                {bg.name}
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                {bg.promptText || 'sin descripción'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: 4 }}>
                <div style={{ display: 'flex', gap: 4 }}>
                  <div className="color-dot" style={{ background: bg.color || '#999' }} />
                  {projects.length > 1 && (
                    <select
                      className="input"
                      style={{ fontSize: 10, maxWidth: 88, cursor: 'pointer', padding: '1px 2px', height: 'auto' }}
                      value=""
                      onClick={e => e.stopPropagation()}
                      onChange={async (e) => { if (e.target.value) { await copyToProject(bg, e.target.value); e.target.value = '' } }}
                      title="copiar a otro proyecto"
                    >
                      <option value="">copiar</option>
                      {projects.filter(p => p.id !== projectId).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  )}
                </div>
                <button
                  className="btn btn-ghost btn-sm btn-danger"
                  onClick={(e) => { e.stopPropagation(); if (confirm('¿Eliminar?')) remove(bg.id) }}
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
