import { useEffect, useState } from 'react'
import useObjectStore from '../../store/objectStore'

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

export default function ObjectList({ onNew, onEdit }) {
  const objects = useObjectStore(s => s.objects)
  const loaded = useObjectStore(s => s.loaded)
  const remove = useObjectStore(s => s.remove)

  if (!loaded) return <div style={{ color: 'var(--color-text-muted)', padding: 24 }}>cargando...</div>

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}>objetos</h1>
        <button className="btn btn-primary" onClick={onNew}>nuevo objeto</button>
      </div>

      {objects.length === 0 ? (
        <div style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
          sin objetos aún. crea uno para empezar.
        </div>
      ) : (
        <div className="entity-grid">
          {objects.map(obj => (
            <div
              key={obj.id}
              className="entity-card"
              onClick={() => onEdit(obj)}
            >
              <ObjectThumb referenceImages={obj.referenceImages} />
              <div style={{ fontWeight: 600, fontSize: 15, lineHeight: 1.3 }}>
                {obj.name}
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                {obj.promptText || 'sin descripción'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: 4 }}>
                <div className="color-dot" style={{ background: obj.color || '#999' }} />
                <button
                  className="btn btn-ghost btn-sm btn-danger"
                  onClick={(e) => { e.stopPropagation(); if (confirm('¿Eliminar?')) remove(obj.id) }}
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
