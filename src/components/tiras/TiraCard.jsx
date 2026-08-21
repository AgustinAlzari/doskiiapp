import { useEffect, useRef, useState } from 'react'
import useClipboardStore from '../../store/clipboardStore'
import { coverOf } from '../../utils/stripCover'

// Tarjeta "carpeta" de una tira: reúne viñetas bajo un título. Es un destino de
// arrastre (tirar una viñeta encima la agrega) y también acepta pegar con ⌘V la
// viñeta copiada. Si `editing` está activo, muestra un input de nombre enfocado.
// El toggle "mostrar a preview" (showInPreview) controla si sus viñetas se ven
// en el mosaico de preview y export.
export default function TiraCard({ tira, strips, onOpen, onAddStrip, editing, onDone, pendingStripIds, onMoveSelected, onTogglePreview }) {
  const [src, setSrc] = useState(null)
  // Muestra la ÚLTIMA viñeta agregada: al pegar/copiar una viñeta esta se
  // agrega al final, así la tarjeta refleja siempre la imagen recién pegada.
  const stripIds = tira.stripIds || []
  const stripsById = (id) => strips.find(s => s.id === id)
  const foundStrips = stripIds.map(stripsById).filter(Boolean)
  const lastStrip = foundStrips[foundStrips.length - 1]
  const cover = coverOf(lastStrip)
  const count = (tira.stripIds || []).length
  const pending = Array.isArray(pendingStripIds) ? pendingStripIds.filter(id => !(tira.stripIds || []).includes(id)) : []

  const copiedStripId = useClipboardStore(s => s.copiedStripId)
  const stripAlready = copiedStripId ? (tira.stripIds || []).includes(copiedStripId) : false

  const inputRef = useRef(null)
  const [draft, setDraft] = useState(tira.title || '')
  const [over, setOver] = useState(false)

  useEffect(() => {
    let active = true
    if (cover?.path && window.api?.references) {
      window.api.references.read(cover.path).then(url => { if (active) setSrc(url) })
    } else setSrc(null)
    return () => { active = false }
  }, [cover?.path])

  // Enfocar el input del nombre al crear (editing).
  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus()
  }, [editing])

  const commitTitle = () => {
    const t = draft.trim()
    if (t && t !== tira.title) onDone?.(t)
    else if (onDone) onDone(tira.title)
  }

  const handleKeyDown = (e) => {
    // Pelear con el teclado típico: ⌘V pega la viñeta copiada en esta tira.
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'v') {
      if (copiedStripId && !stripAlready) {
        e.preventDefault()
        onAddStrip?.(copiedStripId)
      }
    }
    if (editing) {
      if (e.key === 'Enter') { e.preventDefault(); commitTitle() }
      if (e.key === 'Escape') { setDraft(tira.title || ''); onDone?.(tira.title) }
      e.stopPropagation()
    }
  }

  return (
    <div
      tabIndex={0}
      onClick={() => { if (!editing) onOpen() }}
      onKeyDown={handleKeyDown}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        const listRaw = e.dataTransfer.getData('application/x-doski-strip-list')
        if (listRaw) {
          try {
            const ids = JSON.parse(listRaw)
            ;(Array.isArray(ids) ? ids : []).forEach(id => onAddStrip?.(id))
            return
          } catch {}
        }
        const id = e.dataTransfer.getData('application/x-doski-strip')
        if (id) onAddStrip?.(id)
      }}
      title={count > 0 ? 'abrir la tira (⌘V para pegar una viñeta copiada)' : 'tira vacía: arrastrá viñetas acá'}
      style={{
        width: 190,
        minHeight: 200,
        border: over ? '2px solid var(--color-text)' : '2px dashed var(--color-border)',
        borderRadius: 10,
        background: 'rgba(0,0,0,0.02)',
        cursor: editing ? 'default' : 'pointer',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        outline: 'none',
        transition: 'border-color 0.1s',
      }}
    >
      <div
        style={{
          height: 110,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          background: '#fff',
          borderBottom: '1px solid var(--color-border-muted)',
        }}
      >
        {src ? (
          <img src={src} alt="" draggable={false} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
        ) : (
          <span style={{ fontSize: 22, color: 'var(--color-text-muted)' }}>▤</span>
        )}
      </div>
      <div style={{ padding: 8 }}>
        {editing ? (
          <input
            ref={inputRef}
            className="input"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={commitTitle}
            placeholder="nombre de la tira"
            style={{ fontSize: 13, fontWeight: 600 }}
          />
        ) : (
          <div className="ui-h3" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {tira.title || 'sin título'}
          </div>
        )}
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
          {count === 0 ? 'vacía' : `${count} ${count === 1 ? 'viñeta' : 'viñetas'}`}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
          {pending.length > 0 && (
            <button
              className="btn btn-sm"
              style={{ fontSize: 10, padding: '2px 8px' }}
              onClick={(e) => { e.stopPropagation(); onMoveSelected?.(tira.id) }}
              title={`mover ${pending.length} ${pending.length === 1 ? 'viñeta' : 'viñetas'} a esta tira`}
            >
              mover acá ({pending.length})
            </button>
          )}
          {copiedStripId && !stripAlready && (
            <button
              className="btn btn-sm"
              style={{ fontSize: 10, padding: '2px 8px' }}
              onClick={(e) => { e.stopPropagation(); onAddStrip?.(copiedStripId) }}
              title="pegar la viñeta copiada (⌘V)"
            >
              pegar
            </button>
          )}
          <label
            data-no-drag
            onClick={(e) => e.stopPropagation()}
            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--color-text-muted)', cursor: 'pointer', userSelect: 'none', marginLeft: 'auto' }}
            title="mostrar las viñetas de esta tira en preview y export"
          >
            <input
              type="checkbox"
              checked={!!tira.showInPreview}
              onChange={() => onTogglePreview?.(tira.id)}
              style={{ cursor: 'pointer', accentColor: 'var(--color-text)' }}
            />
            mostrar a preview
          </label>
        </div>
      </div>
    </div>
  )
}
