import { useEffect, useState } from 'react'
import useObjectStore from '../../store/objectStore'
import useProjectStore from '../../store/projectStore'
import { confirmDelete, isInCloud } from '../../utils/confirmDelete'
import { askConfirm } from '../../store/confirmStore'
import EntityImport from '../EntityImport'
import ChatLayout from '../chat/ChatLayout'

function ObjectThumb({ referenceImages }) {
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

export default function ObjectList({ projectId, onNew, onEdit }) {
  const objects = useObjectStore(s => s.objects)
  const loaded = useObjectStore(s => s.loaded)
  const remove = useObjectStore(s => s.remove)
  const save = useObjectStore(s => s.save)
  const projects = useProjectStore(s => s.projects)
  const scoped = objects.filter(o => o.projectId === projectId && !o.comodin)

  const [importing, setImporting] = useState(false)
  const [feedback, setFeedback] = useState('')

  const flash = (msg) => { setFeedback(msg); setTimeout(() => setFeedback(''), 2500) }

  const candidates = projects
    .filter(p => p.id !== projectId)
    .map(p => ({ id: p.id, name: p.name, count: objects.filter(o => o.projectId === p.id && !o.comodin).length }))
    .filter(p => p.count > 0)

  const importFrom = async (source) => {
    const sourceItems = objects.filter(o => o.projectId === source.id && !o.comodin)
    const currentItems = scoped
    const ok = await askConfirm(`¿sobreescribir los ${currentItems.length} objetos actuales con los ${sourceItems.length} objetos de "${source.name}"?`, { confirmLabel: "sobreescribir" })
    if (!ok) { setImporting(false); return }
    for (const item of currentItems) await remove(item.id)
    for (const item of sourceItems) {
      const { id, ...rest } = item
      await save({ ...rest, id: crypto.randomUUID(), projectId })
    }
    setImporting(false)
    flash(`importados ${sourceItems.length} objetos de "${source.name}"`)
  }

  const copyToProject = async (obj, targetId) => {
    await save({
      ...obj,
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
          <h1 className="ui-h1">objetos</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {feedback && <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{feedback}</span>}
            <button className="btn btn-primary" onClick={onNew}>nuevo objeto</button>
            <button className="btn" onClick={() => setImporting(true)} title="traer los objetos de otro proyecto">importar</button>
          </div>
        </div>

      {scoped.length === 0 ? (
        <div style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
          sin objetos aún. crea uno para empezar.
        </div>
      ) : (
        <div className="entity-grid">
          {scoped.map(obj => (
            <div
              key={obj.id}
              className="entity-card"
              onClick={() => onEdit(obj)}
            >
              <ObjectThumb referenceImages={obj.referenceImages} />
              <div className="ui-h3">
                {obj.name}
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                {obj.promptText || 'sin descripción'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: 4 }}>
                <div style={{ display: 'flex', gap: 4 }}>
                  <div className="color-dot" style={{ background: obj.color || '#999' }} />
                  {projects.length > 1 && (
                    <select
                      className="input"
                      style={{ fontSize: 10, maxWidth: 88, cursor: 'pointer', padding: '1px 2px', height: 'auto' }}
                      value=""
                      onClick={e => e.stopPropagation()}
                      onChange={async (e) => { if (e.target.value) { await copyToProject(obj, e.target.value); e.target.value = '' } }}
                      title="copiar a otro proyecto"
                    >
                      <option value="">copiar</option>
                      {projects.filter(p => p.id !== projectId).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  )}
                </div>
                <button
                  className="btn btn-ghost btn-sm btn-danger"
                  onClick={async (e) => { e.stopPropagation(); if (await confirmDelete(obj.name, isInCloud(obj, projects))) remove(obj.id) }}
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {importing && (
        <EntityImport kindLabel="objetos" candidates={candidates} onImport={importFrom} onClose={() => setImporting(false)} />
      )}
      </div>
    </ChatLayout>
  )
}
