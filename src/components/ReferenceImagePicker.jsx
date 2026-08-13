import { useEffect, useState } from 'react'

export default function ReferenceImagePicker({ entityId, entityName, value = [], onChange, label = 'imagen de referencia' }) {
  const [preview, setPreview] = useState(null)
  const [copied, setCopied] = useState(false)
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

  const copyReference = async () => {
    if (!reference?.path || !window.api?.references?.read || !window.api?.clipboard?.writeImage) return
    const url = await window.api.references.read(reference.path)
    if (!url) return
    const base64 = url.split(',')[1]
    const ok = await window.api.clipboard.writeImage(base64)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const pasteReference = async () => {
    if (!window.api?.references?.paste) {
      alert('reiniciá la app para activar "pegar imagen"')
      return
    }
    const safeName = String(entityName || 'referencia').replace(/[^a-z0-9áéíóúüñ_-]+/gi, '_').replace(/^_|_$/g, '').toLowerCase()
    const imported = await window.api.references.paste({ fileName: `${safeName || 'referencia'}-pegada` })
    if (!imported) {
      alert('no hay imagen en el portapapeles: copiá la imagen de la IA (⌘C) y volvé a intentar')
      return
    }
    onChange([imported])
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <label className="label" style={{ marginBottom: 0 }}>{label}</label>
        <div style={{ flex: 1 }} />
        <button type="button" className="btn btn-sm" onClick={copyReference} disabled={!reference}>
          {copied ? 'copiado ✓' : 'copiar'}
        </button>
        <button type="button" className="btn btn-sm" onClick={pasteReference}>
          + pegar imagen
        </button>
      </div>
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
