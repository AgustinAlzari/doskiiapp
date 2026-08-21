import { useEffect, useRef, useState } from 'react'

// Menú desplegable para elegir una entidad (personaje, fondo, objeto...).
// - Ordena las opciones alfabéticamente.
// - Al dejar el mouse QUIETO sobre una opción más de 3s, muestra una miniatura
//   de su imagen de referencia; se esfuma al mover el mouse o al elegir (tildar).
// `allowClear` agrega una opción "sin X" para limpiar el valor.
export default function EntityMenu({ options, value, placeholder, onSelect, allowClear = false, clearLabel = 'sin fondo', style }) {
  const [open, setOpen] = useState(false)
  const [hoverId, setHoverId] = useState(null)
  const [thumb, setThumb] = useState(null) // { src, top }
  const timerRef = useRef(null)
  const hoverRef = useRef(null)
  const boxRef = useRef(null)

  const sorted = [...(options || [])].sort((a, b) =>
    (a.name || '').localeCompare(b.name || '', 'es')
  )
  const selected = options.find(o => o.id === value)

  const clearThumb = () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
    setThumb(null)
  }

  const startTimer = (opt, el) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    const ref = opt.referenceImages?.[0]
    if (!ref?.path || !window.api?.references) return
    timerRef.current = setTimeout(async () => {
      if (hoverRef.current !== opt.id) return
      try {
        const src = await window.api.references.read(ref.path)
        if (!src || hoverRef.current !== opt.id) return
        const boxRect = boxRef.current?.getBoundingClientRect()
        const itemRect = el?.getBoundingClientRect()
        if (!boxRect || !itemRect) return
        setThumb({ src, top: itemRect.top - boxRect.top })
      } catch {}
    }, 3000)
  }

  const onItemEnter = (opt, el) => {
    hoverRef.current = opt.id
    setHoverId(opt.id)
    clearThumb()
    startTimer(opt, el)
  }

  // Cualquier movimiento del mouse esfuma la miniatura y reinicia los 3s.
  const onItemMove = (opt, el) => {
    clearThumb()
    if (hoverRef.current !== opt.id) {
      hoverRef.current = opt.id
      setHoverId(opt.id)
    }
    startTimer(opt, el)
  }

  const onItemLeave = () => {
    hoverRef.current = null
    setHoverId(null)
    clearThumb()
  }

  const onItemClick = (id) => {
    clearThumb()
    setOpen(false)
    onSelect(id)
  }

  // Cerrar con clic afuera.
  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [open])

  return (
    <div ref={boxRef} style={{ position: 'relative', ...style }}>
      <div
        className="input"
        onClick={() => setOpen(v => !v)}
        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, userSelect: 'none' }}
      >
        {selected ? (
          <>
            <span className="color-dot" style={{ background: selected.color || '#999' }} />
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selected.name}</span>
          </>
        ) : (
          <span style={{ flex: 1, color: 'var(--color-text-muted)' }}>{placeholder}</span>
        )}
        <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>▾</span>
      </div>

      {open && (
        <div
          style={{
            position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
            background: 'var(--color-bg)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
            zIndex: 500,
            maxHeight: 260,
            overflowY: 'auto',
          }}
        >
          {allowClear && (
            <div
              onMouseEnter={() => setHoverId(null)}
              onClick={() => onItemClick(null)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', fontSize: 12, cursor: 'pointer', color: 'var(--color-text-muted)' }}
            >
              {clearLabel}
            </div>
          )}
          {sorted.map(opt => (
            <div
              key={opt.id}
              onMouseEnter={(e) => onItemEnter(opt, e.currentTarget)}
              onMouseMove={(e) => onItemMove(opt, e.currentTarget)}
              onMouseLeave={onItemLeave}
              onClick={() => onItemClick(opt.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', fontSize: 12, cursor: 'pointer',
                background: hoverId === opt.id ? 'rgba(0,0,0,0.04)' : 'transparent',
              }}
            >
              <span className="color-dot" style={{ background: opt.color || '#999' }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{opt.name}</span>
            </div>
          ))}
          {sorted.length === 0 && (
            <div style={{ padding: 8, fontSize: 12, color: 'var(--color-text-muted)' }}>sin opciones</div>
          )}
        </div>
      )}

      {thumb && (
        <div
          style={{
            position: 'absolute',
            right: '100%',
            top: thumb.top,
            marginRight: 8,
            width: 160,
            height: 160,
            background: '#fff',
            border: '1px solid var(--color-border)',
            borderRadius: 8,
            boxShadow: '0 6px 18px rgba(0,0,0,0.18)',
            zIndex: 600,
            overflow: 'hidden',
            padding: 4,
            pointerEvents: 'none',
          }}
        >
          <img src={thumb.src} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </div>
      )}
    </div>
  )
}