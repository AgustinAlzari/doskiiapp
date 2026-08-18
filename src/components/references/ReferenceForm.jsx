import { useState } from 'react'
import useReferenceStore from '../../store/referenceStore'
import SpellCheckedTextarea from '../SpellCheckedTextarea'
import ReferenceImagePicker from '../ReferenceImagePicker'
import { REFERENCE_EXTRACTOR_PROMPT } from '../../data/referenceExtractorPrompt'
import { copyToClipboard } from '../../utils/clipboard'
import useAutoSaveBack from '../../utils/useAutoSaveBack'
import FormShade from '../FormShade'
import ChatLayout from '../chat/ChatLayout'

export default function ReferenceForm({ reference, projectId, onCancel }) {
  const save = useReferenceStore(s => s.save)
  const remove = useReferenceStore(s => s.remove)
  const references = useReferenceStore(s => s.references)
  const isNew = !reference?.id

  const [name, setName] = useState(reference?.name || '')
  const [promptText, setPromptText] = useState(reference?.promptText || '')
  const [color, setColor] = useState(reference?.color || '#6e6e73')
  const [saving, setSaving] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const [savedId, setSavedId] = useState(reference?.id || null)
  const [copied, setCopied] = useState(false)
  const [referenceImages, setReferenceImages] = useState(reference?.referenceImages || [])
  const draftId = savedId || reference?.id || 'draft-reference'

  const copyExtractor = async () => {
    await copyToClipboard(REFERENCE_EXTRACTOR_PROMPT)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const payload = () => ({ ...reference, id: savedId || crypto.randomUUID(), projectId: reference?.projectId || projectId, name, promptText, color, referenceImages })
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    const updated = await save(payload())
    setSavedId(updated.id)
    setSaving(false)
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 2000)
  }
  const { goBack } = useAutoSaveBack({
    save,
    remove,
    payload,
    fields: ['name', 'promptText', 'color', 'referenceImages'],
    hasContent: !!name.trim(),
    getStored: (id) => references.find(r => r.id === id) || null,
    onBack: onCancel,
  })

  return (
    <ChatLayout>
      <div style={{ maxWidth: 520 }}>
        <div className="section-header">
          <button className="back-arrow" onClick={goBack} title="volver">←</button>
          <h1 className="ui-h1">
            {isNew ? 'nueva referencia' : 'editar referencia'}
          </h1>
        </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <label className="label">nombre</label>
          <input
            className="input"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Cortina del teatro"
            autoFocus
          />
        </div>

        <FormShade active={!!name.trim()} hint="colocá un nombre para poder editar el resto">
        <ReferenceImagePicker entityId={draftId} entityName={name} value={referenceImages} onChange={setReferenceImages} />

        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <label className="label" style={{ marginBottom: 0 }}>descripción</label>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ fontSize: 11 }}
              onClick={copyExtractor}
            >
              {copied ? 'copiado ✓' : 'copiar extractor'}
            </button>
          </div>
          <SpellCheckedTextarea
            value={promptText}
            onChange={e => setPromptText(e.target.value)}
            placeholder="describí la referencia: ciudad, cortina, textura, arquitectura, lo que sea..."
            minRows={4}
          />
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
            pegá el "copiar extractor" en una IA multimodal junto con la imagen, y pegá su respuesta acá.
          </div>
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

        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" className="btn btn-primary" disabled={saving || !name.trim()}>
            {saving ? 'guardando...' : savedFlash ? 'guardado ✓' : 'guardar'}
          </button>
        </div>
        </FormShade>
      </form>
      </div>
    </ChatLayout>
  )
}