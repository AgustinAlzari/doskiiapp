import { useEffect, useState } from 'react'

export default function ReferenceImagePicker({ entityId, entityName, value = [], onChange, label = 'imagen de referencia' }) {
  const [preview, setPreview] = useState(null)
  const reference = value[0]

  useEffect(() => {
    let active = true
    if (reference?.path && window.api?.references) {
      window.api.references.read(reference.path).then(url => { if (active) setPreview(url) })
    } else setPreview(null)
    return () => { active = false }
  }, [reference?.path])

  const choose = async () => {
    if (!window.api?.references) return
    const sourcePath = await window.api.references.choose()
    if (!sourcePath) return
    const imported = await window.api.references.import({ sourcePath, entityId, entityName })
    onChange([imported])
  }

  return (
    <div>
      <label className="label">{label}</label>
      {reference ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {preview && <img src={preview} alt="referencia" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 5, border: '1px solid var(--color-border)' }} />}
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis' }}>{reference.fileName}</div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={choose}>reemplazar</button>
            <button type="button" className="btn btn-ghost btn-sm btn-danger" onClick={() => onChange([])}>quitar</button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn btn-ghost btn-sm" onClick={choose}>+ cargar imagen</button>
      )}
    </div>
  )
}
