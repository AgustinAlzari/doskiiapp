import { useState } from 'react'
import useObjectStore from '../../store/objectStore'
import AutoTextarea from '../editor/AutoTextarea'
import ReferenceImagePicker from '../ReferenceImagePicker'

export default function ObjectForm({ object, projectId, onSaved, onCancel }) {
  const save = useObjectStore(s => s.save)
  const isNew = !object?.id

  const [name, setName] = useState(object?.name || '')
  const [promptText, setPromptText] = useState(object?.promptText || '')
  const [color, setColor] = useState(object?.color || '#ff9500')
  const [saving, setSaving] = useState(false)
  const [referenceImages, setReferenceImages] = useState(object?.referenceImages || [])
  const draftId = object?.id || 'draft-object'

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    await save({ ...object, id: object?.id || crypto.randomUUID(), projectId: object?.projectId || projectId, name, promptText, color, referenceImages })
    setSaving(false)
    onSaved()
  }

  return (
    <div style={{ maxWidth: 520 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}>
          {isNew ? 'nuevo objeto' : 'editar objeto'}
        </h1>
        <button className="btn btn-ghost" onClick={onCancel}>cancelar</button>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <label className="label">nombre</label>
          <input
            className="input"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Lámpara vintage"
            autoFocus
          />
        </div>

        <ReferenceImagePicker entityId={draftId} entityName={name} value={referenceImages} onChange={setReferenceImages} />

        <div>
          <label className="label">prompt del objeto</label>
          <AutoTextarea
            value={promptText}
            onChange={e => setPromptText(e.target.value)}
            placeholder="describe el objeto: apariencia, material, tamaño, estilo..."
            minRows={4}
          />
        </div>

        <div>
          <label className="label">color de identificación</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <input
              type="color"
              value={color}
              onChange={e => setColor(e.target.value)}
              style={{ width: 32, height: 32, border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', cursor: 'pointer', padding: 2 }}
            />
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{color}</span>
          </div>
        </div>

        {name && (
          <div className="card" style={{ fontSize: 12, color: 'var(--color-text-2)' }}>
            <span style={{ color: 'var(--color-text-muted)' }}>preview: </span>
            <strong>{name}</strong>: {promptText || '...'}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" className="btn btn-primary" disabled={saving || !name.trim()}>
            {saving ? 'guardando...' : 'guardar'}
          </button>
          <button type="button" className="btn" onClick={onCancel}>cancelar</button>
        </div>
      </form>
    </div>
  )
}
