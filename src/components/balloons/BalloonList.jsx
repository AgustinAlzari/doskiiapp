import { useEffect, useState } from 'react'
import useBalloonStore from '../../store/balloonStore'
import useProjectStore from '../../store/projectStore'
import { confirmDelete, isInCloud } from '../../utils/confirmDelete'
import { BALLOON_LAWS } from '../../data/balloonLaws'
import ChatLayout from '../chat/ChatLayout'

const KIND_LABELS = { speech: 'diálogo', thought: 'pensamiento', narration: 'narración', other: 'globo x' }

function BalloonThumb({ referenceImages }) {
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

export default function BalloonList({ projectId, onNew, onEdit }) {
  const balloons = useBalloonStore(s => s.balloons)
  const loaded = useBalloonStore(s => s.loaded)
  const remove = useBalloonStore(s => s.remove)
  const save = useBalloonStore(s => s.save)
  const projects = useProjectStore(s => s.projects)
  const scoped = balloons.filter(b => b.projectId === projectId)

  const copyToProject = async (balloon, targetId) => {
    await save({
      ...balloon,
      id: crypto.randomUUID(),
      projectId: targetId,
      createdAt: new Date().toISOString(),
    })
  }

  if (!loaded) return <div style={{ color: 'var(--color-text-muted)', padding: 24 }}>cargando...</div>

  return (
    <ChatLayout>
      <div>
        <div className="section-header" style={{ justifyContent: 'space-between' }}>
          <h1 className="ui-h1">globos</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button className="btn btn-primary" onClick={onNew}>nuevo globo</button>
          </div>
      </div>

      {scoped.length === 0 ? (
        <div style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
          sin globos aún. crea uno para definir el estilo y las restricciones de un globo.
        </div>
      ) : (
        <div className="entity-grid">
          {scoped.map(balloon => {
            const lawCount = BALLOON_LAWS.filter(law => balloon.laws && balloon.laws[law.id]).length
            return (
              <div
                key={balloon.id}
                className="entity-card"
                onClick={() => onEdit(balloon)}
              >
                <BalloonThumb referenceImages={balloon.referenceImages} />
                <div className="ui-h3">
                  {balloon.name}
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                  {KIND_LABELS[balloon.kind] || balloon.kind || 'globo'} · {lawCount} restricciones
                  {balloon.text ? ` · "${balloon.text.slice(0, 30)}"` : ''}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: 4 }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <div className="color-dot" style={{ background: balloon.color || '#999' }} />
                    {projects.length > 1 && (
                      <select
                        className="input"
                        style={{ fontSize: 10, maxWidth: 88, cursor: 'pointer', padding: '1px 2px', height: 'auto' }}
                        value=""
                        onClick={e => e.stopPropagation()}
                        onChange={async (e) => { if (e.target.value) { await copyToProject(balloon, e.target.value); e.target.value = '' } }}
                        title="copiar a otro proyecto"
                      >
                        <option value="">copiar</option>
                        {projects.filter(p => p.id !== projectId).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    )}
                  </div>
                  <button
                    className="btn btn-ghost btn-sm btn-danger"
                    onClick={(e) => { e.stopPropagation(); if (confirmDelete(balloon.name, isInCloud(balloon, projects))) remove(balloon.id) }}
                  >
                    ×
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
      </div>
    </ChatLayout>
  )
}
