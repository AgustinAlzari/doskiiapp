import { useEffect, useMemo, useRef, useState } from 'react'
import { coverOf } from '../../utils/stripCover'

const GENERAL = '__general__'

// Desplegable de tiras para "preview y export": lista la base (general) y las
// tiras del proyecto. Cada opción muestra la miniatura de la última viñeta.
// Al tocar (hover) una opción su borde se vuelve muy grueso en negro sutil;
// clic selecciona/deselecciona esa tira (pueden elegirse varias, para ver
// continuidades). El mosaico se actualiza en vivo debajo.
export default function TiraSelect({ tiras, strips, value, onChange }) {
  const [open, setOpen] = useState(false)
  const [thumbs, setThumbs] = useState({})
  const [hoverId, setHoverId] = useState(null)
  const boxRef = useRef(null)

  const inTiraIds = useMemo(() => new Set(tiras.flatMap(t => t.stripIds || [])), [tiras])
  const generalCount = strips.filter(s => !inTiraIds.has(s.id)).length

  const options = useMemo(() => [
    { id: GENERAL, title: 'general', count: generalCount },
    ...tiras.map(t => ({ id: t.id, title: t.title || 'sin título', count: (t.stripIds || []).length })),
  ], [tiras, generalCount])

  const selectedSet = useMemo(() => new Set(value || []), [value])
  const selectedOptions = options.filter(o => selectedSet.has(o.id))

  // Carga la miniatura de cada tira (portada de la última viñeta) al abrir.
  useEffect(() => {
    if (!open) return
    let active = true
    const load = async () => {
      const next = {}
      for (const opt of options) {
        if (opt.id === GENERAL) continue
        const t = tiras.find(x => x.id === opt.id)
        const ids = t?.stripIds || []
        let src = null
        for (let i = ids.length - 1; i >= 0 && !src; i--) {
          const s = strips.find(x => x.id === ids[i])
          const r = coverOf(s)
          if (r?.path && window.api?.references) {
            try { const u = await window.api.references.read(r.path); if (active) src = u } catch {}
          }
        }
        if (active && src) next[opt.id] = src
      }
      if (active) setThumbs(next)
    }
    load()
    return () => { active = false }
  }, [open, options, tiras, strips])

  // Cerrar con clic afuera.
  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [open])

  const toggle = (id) => {
    const next = new Set(selectedSet)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onChange([...next])
  }

  const buttonLabel = selectedOptions.length === 0
    ? 'mostrar en preview'
    : selectedOptions.map(o => o.title).join(' · ')

  return (
    <div ref={boxRef} style={{ position: 'relative', display: 'inline-block' }}>
      <div
        className="input"
        onClick={() => setOpen(v => !v)}
        style={{
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 12,
          height: 24,
          padding: '0 10px',
          userSelect: 'none',
          whiteSpace: 'nowrap',
          maxWidth: 320,
        }}
        title="tiras que se muestran en el mosaico (seleccioná una o varias)"
      >
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {buttonLabel}
        </span>
        <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>▾</span>
      </div>

      {open && (
        <div
          style={{
            position: 'absolute', top: '100%', left: 0, marginTop: 4,
            background: 'var(--color-bg)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
            zIndex: 500,
            maxHeight: 300,
            overflowY: 'auto',
            minWidth: 240,
          }}
        >
          {options.map(opt => {
            const isHovered = hoverId === opt.id
            const isSelected = selectedSet.has(opt.id)
            const thick = isSelected || isHovered
            return (
              <div
                key={opt.id}
                onMouseEnter={() => setHoverId(opt.id)}
                onMouseLeave={() => setHoverId(null)}
                onClick={() => toggle(opt.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '5px 10px', fontSize: 12, cursor: 'pointer',
                  border: thick ? '3px solid rgba(0,0,0,0.75)' : '3px solid transparent',
                  borderRadius: 6,
                  transition: 'border-color 0.08s ease',
                }}
              >
                <div
                  style={{
                    width: 52, height: 40, flexShrink: 0,
                    background: '#fff', border: '1px solid var(--color-border)',
                    borderRadius: 4, overflow: 'hidden',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {thumbs[opt.id] ? (
                    <img src={thumbs[opt.id]} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                  ) : (
                    <span style={{ fontSize: 16, color: 'var(--color-text-muted)' }}>▤</span>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {opt.title}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>
                    {opt.count} {opt.count === 1 ? 'viñeta' : 'viñetas'}
                  </div>
                </div>
                {isSelected && (
                  <span style={{ fontSize: 14, color: 'var(--color-text)', flexShrink: 0 }}>✓</span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}