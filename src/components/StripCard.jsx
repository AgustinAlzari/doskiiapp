import { useEffect, useRef, useState } from 'react'
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
// Si recibe `tiraOptions`/`tiraId`/`onAssignTira`, muestra debajo un menú
// desplegable para asignar la viñeta a una tira (o devolverla a general).
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
  tiraOptions,
  tiraId,
  onAssignTira,
  editing,
  onRename,
}) {
  const [draft, setDraft] = useState(strip.title || '')
  const inputRef = useRef(null)

  // Al entrar en modo edición, enfocar el input y seleccionar el nombre.
  useEffect(() => {
    if (editing) {
      setDraft(strip.title || '')
      setTimeout(() => {
        if (inputRef.current) { inputRef.current.focus(); inputRef.current.select() }
      }, 0)
    }
  }, [editing])

  const commitName = () => {
    const t = draft.trim()
    onRename?.(t || strip.title || 'sin título')
  }

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
      onClick={() => { if (!editing) onOpen(strip) }}
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
        {editing ? (
          <input
            ref={inputRef}
            data-no-drag
            className="input"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); commitName() }
              if (e.key === 'Escape') { setDraft(strip.title || ''); onRename?.(strip.title || '') }
              e.stopPropagation()
            }}
            onBlur={commitName}
            onClick={(e) => e.stopPropagation()}
            style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600 }}
          />
        ) : (
          <div className="ui-h3" style={{ flex: 1, minWidth: 0 }}>
            {strip.title || 'sin título'}
          </div>
        )}
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

      {tiraOptions && onAssignTira && (
        <select
          data-no-drag
          className="input"
          value={tiraId || ''}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => { e.stopPropagation(); onAssignTira(strip.id, e.target.value || null) }}
          title="asignar a una tira (o devolver a general)"
          style={{ width: '100%', fontSize: 11, marginTop: 8, cursor: 'pointer' }}
        >
          <option value="">general</option>
          {tiraOptions.map(t => (
            <option key={t.id} value={t.id}>{t.title || 'sin título'}</option>
          ))}
        </select>
      )}
    </div>
  )
}