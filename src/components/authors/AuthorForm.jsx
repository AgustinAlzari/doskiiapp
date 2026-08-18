import { useState } from 'react'
import useAuthorStore from '../../store/authorStore'
import AutoTextarea from '../editor/AutoTextarea'
import ReferenceImagePicker from '../ReferenceImagePicker'
import useAutoSaveBack from '../../utils/useAutoSaveBack'
import FormShade from '../FormShade'
import ChatLayout from '../chat/ChatLayout'

export default function AuthorForm({ author, onCancel }) {
  const save = useAuthorStore(s => s.save)
  const remove = useAuthorStore(s => s.remove)
  const authors = useAuthorStore(s => s.authors)
  const isNew = !author?.id

  const [fullName, setFullName] = useState(author?.fullName || '')
  const [signatureText, setSignatureText] = useState(author?.signatureText || '')
  const [signatureImage, setSignatureImage] = useState(author?.signatureImage || [])
  const [saving, setSaving] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const [savedId, setSavedId] = useState(author?.id || null)
  const draftId = savedId || author?.id || 'draft-author'

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!fullName.trim()) return
    setSaving(true)
    const updated = await save({ ...author, id: savedId || crypto.randomUUID(), fullName, signatureText, signatureImage })
    setSavedId(updated.id)
    setSaving(false)
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 2000)
  }

  const payload = () => ({ ...author, id: savedId || crypto.randomUUID(), fullName, signatureText, signatureImage })
  const { goBack } = useAutoSaveBack({
    save,
    remove,
    payload,
    fields: ['fullName', 'signatureText', 'signatureImage'],
    hasContent: !!fullName.trim(),
    getStored: (id) => authors.find(a => a.id === id) || null,
    onBack: onCancel,
  })

  return (
    <ChatLayout>
      <div style={{ maxWidth: 520 }}>
        <div className="section-header">
          <button className="back-arrow" onClick={goBack} title="volver">←</button>
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

        <FormShade active={!!fullName.trim()} hint="colocá el nombre para poder editar el resto">
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
            {saving ? 'guardando...' : savedFlash ? 'guardado ✓' : 'guardar'}
          </button>
        </div>
        </FormShade>
      </form>
      </div>
    </ChatLayout>
  )
}
