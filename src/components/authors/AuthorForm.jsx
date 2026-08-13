import { useState } from 'react'
import useAuthorStore from '../../store/authorStore'
import AutoTextarea from '../editor/AutoTextarea'
import ReferenceImagePicker from '../ReferenceImagePicker'

export default function AuthorForm({ author, onSaved, onCancel }) {
  const save = useAuthorStore(s => s.save)
  const isNew = !author?.id

  const [fullName, setFullName] = useState(author?.fullName || '')
  const [signatureText, setSignatureText] = useState(author?.signatureText || '')
  const [signatureImage, setSignatureImage] = useState(author?.signatureImage || [])
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!fullName.trim()) return
    setSaving(true)
    await save({ ...author, id: author?.id || crypto.randomUUID(), fullName, signatureText, signatureImage })
    setSaving(false)
    onSaved()
  }

  return (
    <div style={{ maxWidth: 520 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button className="back-arrow" onClick={onCancel} title="volver">←</button>
        <h1 className="ui-h1">
          {isNew ? 'nuevo autor' : 'editar autor'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <label className="label">nombre completo</label>
          <input
            className="input"
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            placeholder="Agustín Alzari"
            autoFocus
          />
        </div>

        <div>
          <label className="label">firma en texto</label>
          <AutoTextarea
            value={signatureText}
            onChange={e => setSignatureText(e.target.value)}
            placeholder="el nombre tal como se firma (ej: A. Alzari, @doski...)"
            minRows={2}
          />
        </div>

        <ReferenceImagePicker
          entityId={author?.id || 'draft-author'}
          entityName={fullName || 'autor'}
          value={signatureImage}
          onChange={setSignatureImage}
          label="firma en imagen (se va a poder insertar en las imágenes)"
        />

        {fullName && (
          <div className="card" style={{ fontSize: 12, color: 'var(--color-text-2)' }}>
            <span style={{ color: 'var(--color-text-muted)' }}>firma: </span>
            <strong>{signatureText || fullName}</strong>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" className="btn btn-primary" disabled={saving || !fullName.trim()}>
            {saving ? 'guardando...' : 'guardar'}
          </button>
        </div>
      </form>
    </div>
  )
}
