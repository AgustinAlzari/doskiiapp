import { useEffect, useMemo, useRef, useState } from 'react'
import { coverOf } from '../../utils/stripCover'

const GENERAL = '__general__'

// Desplegable de tiras para "preview y export": lista la base (general) y las
// tiras del proyecto. Cada opción muestra la miniatura de la última viñeta.
// Al tocar (hover) una opción su borde se vuelve muy grueso en negro sutil;
// clic selecciona/deselecciona esa tira (pueden elegirse varias, para ver
// continuidades). Las tiras se reordenan ARRASTRÁNDOLAS (arriba = primero en
// la galería); el orden se guarda con onReorder. El mosaico se actualiza en
// vivo debajo.
export default function TiraSelect({ tiras, strips, value, onChange, onReorder }) {
  const [open, setOpen] = useState(false)
  const [thumbs, setThumbs] = useState({})
  const [hoverId, setHoverId] = useState(null)
  const boxRef = useRef(null)

  // Reordenar tiras arrastrando dentro del menú.
  const [dragIdx, setDragIdx] = useState(null)
  const [insertIdx, setInsertIdx] = useState(null)

  const inTiraIds = useMemo(() => new Set(tiras.flatMap(t => t.stripIds || [])), [tiras])
  const generalCount = strips.filter(s => !inTiraIds.has(s.id)).length

  // "general" solo se muestra si tiene viñetas sueltas; las tiras por defecto
  // (borrador) vacías se ocultan para no ensuciar el menú.
  const options = useMemo(() => {
    const opts = []
    if (generalCount > 0) opts.push({ id: GENERAL, title: 'general', count: generalCount })
    tiras.forEach((t, i) => {
      // Solo las tiras con viñetas: una tira vacía (incluso la por defecto) no
      // aporta nada y ensucia el menú con tiras fantasma.
      const hasStrips = (t.stripIds || []).length > 0
      if (!hasStrips) return
      opts.push({ id: t.id, title: t.title || 'sin título', count: (t.stripIds || []).length, tiraIdx: i })
    })
    return opts
  }, [tiras, generalCount])

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

  // Reordenar arrastrando: el índice del arrastre es sobre la lista de tiras
  // (general queda fija arriba y no se arrastra).
  const onTiraDragStart = (e, tiraIdx) => {
    setDragIdx(tiraIdx)
    setInsertIdx(null)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', '') // Firefox necesita setData para iniciar el drag
  }
  const onTiraDragOver = (e, tiraIdx) => {
    if (dragIdx == null) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const rect = e.currentTarget.getBoundingClientRect()
    const before = e.clientY < rect.top + rect.height / 2
    const next = before ? tiraIdx : tiraIdx + 1
    if (next !== insertIdx) setInsertIdx(next)
  }
  const onTiraDrop = (e, tiraIdx) => {
    e.preventDefault()
    if (dragIdx != null) {
      let target = insertIdx
      if (target == null) {
        const rect = e.currentTarget.getBoundingClientRect()
        target = e.clientY < rect.top + rect.height / 2 ? tiraIdx : tiraIdx + 1
      }
      const next = [...tiras]
      const [moved] = next.splice(dragIdx, 1)
      let at = target > dragIdx ? target - 1 : target
      at = Math.max(0, Math.min(next.length, at))
      next.splice(at, 0, moved)
      if (onReorder) onReorder(next.map(t => t.id))
    }
    setDragIdx(null)
    setInsertIdx(null)
  }
  const onTiraDragEnd = () => { setDragIdx(null); setInsertIdx(null) }

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
                draggable={opt.id !== GENERAL}
                onMouseEnter={() => setHoverId(opt.id)}
                onMouseLeave={() => setHoverId(null)}
                onDragStart={(e) => onTiraDragStart(e, opt.tiraIdx)}
                onDragOver={(e) => onTiraDragOver(e, opt.tiraIdx)}
                onDrop={(e) => onTiraDrop(e, opt.tiraIdx)}
                onDragEnd={onTiraDragEnd}
                onClick={() => toggle(opt.id)}
                style={{
                  position: 'relative',
                  display: 'flex', alignItems: 'center', gap: 10, padding: '5px 10px', fontSize: 12,
                  cursor: opt.id === GENERAL ? 'pointer' : 'grab',
                  opacity: dragIdx === opt.tiraIdx ? 0.4 : 1,
                  border: thick ? '3px solid rgba(0,0,0,0.75)' : '3px solid transparent',
                  borderRadius: 6,
                  transition: 'border-color 0.08s ease',
                }}
                title={opt.id === GENERAL ? undefined : 'clic: mostrar/ocultar en preview · arrastrá para reordenar'}
              >
                {dragIdx != null && insertIdx === opt.tiraIdx && (
                  <span style={{ position: 'absolute', top: -5, left: 8, right: 8, height: 3, background: 'var(--color-accent)', borderRadius: 2, zIndex: 3 }} />
                )}
                {dragIdx != null && insertIdx === opt.tiraIdx + 1 && (
                  <span style={{ position: 'absolute', bottom: -5, left: 8, right: 8, height: 3, background: 'var(--color-accent)', borderRadius: 2, zIndex: 3 }} />
                )}
                <div
                  style={{
                    width: 52, height: 40, flexShrink: 0,
                    background: '#fff', border: '1px solid var(--color-border)',
                    borderRadius: 4, overflow: 'hidden',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {thumbs[opt.id] ? (
                    <img src={thumbs[opt.id]} alt="" draggable={false} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', pointerEvents: 'none' }} />
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