import { useEffect, useState } from 'react'
import useReferenceStore from '../../store/referenceStore'
import useProjectStore from '../../store/projectStore'
import { confirmDelete, isInCloud } from '../../utils/confirmDelete'
import { askConfirm } from '../../store/confirmStore'
import EntityImport from '../EntityImport'
import ChatLayout from '../chat/ChatLayout'

function ReferenceThumb({ referenceImages }) {
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

export default function ReferenceList({ projectId, onNew, onEdit }) {
  const references = useReferenceStore(s => s.references)
  const loaded = useReferenceStore(s => s.loaded)
  const remove = useReferenceStore(s => s.remove)
  const save = useReferenceStore(s => s.save)
  const projects = useProjectStore(s => s.projects)
  const scoped = references.filter(r => r.projectId === projectId)

  const [importing, setImporting] = useState(false)
  const [feedback, setFeedback] = useState('')

  const flash = (msg) => { setFeedback(msg); setTimeout(() => setFeedback(''), 2500) }

  const candidates = projects
    .filter(p => p.id !== projectId)
    .map(p => ({ id: p.id, name: p.name, count: references.filter(r => r.projectId === p.id).length }))
    .filter(p => p.count > 0)

  const importFrom = async (source) => {
    const sourceItems = references.filter(r => r.projectId === source.id)
    const currentItems = scoped
    const ok = await askConfirm(`¿sobreescribir las ${currentItems.length} referencias actuales con las ${sourceItems.length} de "${source.name}"?`, { confirmLabel: 'sobreescribir' })
    if (!ok) { setImporting(false); return }
    for (const item of currentItems) await remove(item.id)
    for (const item of sourceItems) {
      const { id, ...rest } = item
      await save({ ...rest, id: crypto.randomUUID(), projectId })
    }
    setImporting(false)
    flash(`importadas ${sourceItems.length} referencias de "${source.name}"`)
  }

  if (!loaded) return <div style={{ color: 'var(--color-text-muted)', padding: 24 }}>cargando...</div>

  return (
    <ChatLayout>
      <div>
        <div className="section-header" style={{ justifyContent: 'space-between' }}>
          <h1 className="ui-h1">referencias</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {feedback && <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{feedback}</span>}
            <button className="btn btn-primary" onClick={onNew}>nueva referencia</button>
            <button className="btn" onClick={() => setImporting(true)} title="traer las referencias de otro proyecto">importar</button>
          </div>
        </div>

      {scoped.length === 0 ? (
        <div style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
          sin referencias aún. creá una para tenerla a mano al armar el prompt.
        </div>
      ) : (
        <div className="entity-grid">
          {scoped.map(ref => (
            <div
              key={ref.id}
              className="entity-card"
              onClick={() => onEdit(ref)}
            >
              <ReferenceThumb referenceImages={ref.referenceImages} />
              <div className="ui-h3">
                {ref.name}
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                {ref.promptText || 'sin descripción'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: 4 }}>
                <div className="color-dot" style={{ background: ref.color || '#999' }} />
                <button
                  className="btn btn-ghost btn-sm btn-danger"
                  onClick={async (e) => { e.stopPropagation(); if (await confirmDelete(ref.name, isInCloud(ref, projects))) remove(ref.id) }}
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {importing && (
        <EntityImport kindLabel="referencias" candidates={candidates} onImport={importFrom} onClose={() => setImporting(false)} />
      )}
      </div>
    </ChatLayout>
  )
}