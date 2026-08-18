import { useEffect, useState } from 'react'
import { coverOf } from '../utils/stripCover'

function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  const day = d.getDate()
  const month = months[d.getMonth()]
  const year = d.getFullYear()
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${day} ${month} ${year}, ${h}:${m}`
}

function StripCover({ strip }) {
  const [src, setSrc] = useState(null)
  const cover = coverOf(strip)
  useEffect(() => {
    let active = true
    if (cover?.path && window.api?.references) {
      window.api.references.read(cover.path).then(url => { if (active) setSrc(url) })
    } else setSrc(null)
    return () => { active = false }
  }, [cover?.path])

  if (!src) return null
  return (
    <div style={{ height: 120, border: '1px solid var(--color-border)', borderRadius: 6, overflow: 'hidden', marginBottom: 8, background: 'white' }}>
      <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
    </div>
  )
}

// Ficha de viñeta única: la misma en la vista general de viñetas y dentro de una
// tira, con toda su funcionalidad (clic abre el editor, ⧉ duplica, copiar y ×).
export default function StripCard({
  strip,
  idx,
  badge,
  onOpen,
  onDuplicate,
  onCopy,
  onRemove,
  copied,
  removeTitle = 'eliminar viñeta',
  draggable,
  dragging,
  insertBefore,
  insertAfter,
  onMouseDown,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}) {
  return (
    <div
      draggable={draggable}
      onMouseDown={onMouseDown}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className="strip-card"
      style={{ position: 'relative', cursor: 'grab', opacity: dragging ? 0.4 : 1 }}
      onClick={() => onOpen(strip)}
    >
      {/* Línea de inserción en el espacio entre tarjetas */}
      {insertBefore && (
        <span style={{ position: 'absolute', left: -8, top: 0, bottom: 0, width: 3, background: 'var(--color-accent)', borderRadius: 2, zIndex: 3 }} />
      )}
      {insertAfter && (
        <span style={{ position: 'absolute', right: -8, top: 0, bottom: 0, width: 3, background: 'var(--color-accent)', borderRadius: 2, zIndex: 3 }} />
      )}
      {badge != null && (
        <div style={{ position: 'absolute', top: 4, left: 4, zIndex: 2, background: '#fff', border: '1px solid var(--color-border)', borderRadius: 4, fontSize: 11, padding: '0 6px', color: 'var(--color-text-2)' }}>
          {badge}
        </div>
      )}
      <StripCover strip={strip} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div className="ui-h3" style={{ flex: 1, minWidth: 0 }}>
          {strip.title || 'sin título'}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {onDuplicate && (
            <button
              data-no-drag
              className="btn btn-ghost btn-sm"
              style={{ flexShrink: 0, fontSize: 11 }}
              title="duplicar viñeta"
              onClick={async (e) => { e.stopPropagation(); await onDuplicate(strip) }}
            >
              ⧉
            </button>
          )}
          {onCopy && (
            <button
              data-no-drag
              className="btn btn-ghost btn-sm"
              style={{ flexShrink: 0, fontSize: 11 }}
              title={copied ? 'copiada ✓ (⌘V en una tira)' : 'copiar viñeta (⌘C)'}
              onClick={(e) => { e.stopPropagation(); onCopy(strip.id) }}
            >
              {copied ? '✓' : 'copiar'}
            </button>
          )}
          {onRemove && (
            <button
              data-no-drag
              className="btn btn-ghost btn-sm btn-danger"
              style={{ flexShrink: 0 }}
              title={removeTitle}
              onClick={async (e) => { e.stopPropagation(); await onRemove(strip) }}
            >
              ×
            </button>
          )}
        </div>
      </div>

      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', lineHeight: 1.4, marginTop: 2 }}>
        {strip.createdAt && <span>creada {formatDate(strip.createdAt)}</span>}
        {strip.updatedAt && strip.updatedAt !== strip.createdAt && (
          <span> · modif. {formatDate(strip.updatedAt)}</span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: 8 }}>
        <div className="strip-card-dots">
          {(strip.panels || []).slice(0, 10).map((p, i) => (
            <div
              key={p.id || i}
              className={`strip-card-dot ${p.scene ? 'has-scene' : ''}`}
              title={`cuadro ${i + 1}${p.scene ? ': ' + p.scene : ''}`}
            />
          ))}
        </div>
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
          {strip.panels?.length || 0} cuadros
        </div>
      </div>
    </div>
  )
}