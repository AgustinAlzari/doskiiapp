const clamp = (v) => Math.max(0, Math.min(1, v))

// Línea de horizonte editable: un segmento con dos extremos independientes
// (izquierdo y derecho). Cada extremo se arrastra por separado para achicar el
// horizonte de un lado u otro, o mover su altura de forma independiente.
// Si el horizonte solo tiene `y` (datos viejos), se interpreta como una línea
// a ancho completo a esa altura.
export default function CompositionGuides({ grid = 'thirds', horizon, visible, onMoveHorizon }) {
  const positions = grid === 'halves' ? [50] : [33.333, 66.666]
  const h = horizon || null
  const x1 = h?.x1 ?? 0
  const y1 = h?.y1 ?? h?.y ?? 0.5
  const x2 = h?.x2 ?? 1
  const y2 = h?.y2 ?? h?.y ?? 0.5

  const beginDrag = (e, which) => {
    e.stopPropagation()
    const canvas = e.currentTarget.parentElement
    const startX = e.clientX
    const startY = e.clientY
    const sx1 = x1, sy1 = y1, sx2 = x2, sy2 = y2
    const move = (event) => {
      const rect = canvas.getBoundingClientRect()
      const dx = (event.clientX - startX) / rect.width
      const dy = (event.clientY - startY) / rect.height
      let next
      if (which === 'left') next = { x1: clamp(sx1 + dx), y1: clamp(sy1 + dy), x2: sx2, y2: sy2 }
      else if (which === 'right') next = { x1: sx1, y1: sy1, x2: clamp(sx2 + dx), y2: clamp(sy2 + dy) }
      else next = { x1: clamp(sx1 + dx), y1: clamp(sy1 + dy), x2: clamp(sx2 + dx), y2: clamp(sy2 + dy) }
      onMoveHorizon?.({ ...h, ...next })
    }
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  return (
    <>
      {visible && (
        <div className="composition-grid">
          {positions.map(value => (
            <div key={`v-${value}`} className="grid-line-v" style={{ left: `${value}%` }} />
          ))}
          {positions.map(value => (
            <div key={`h-${value}`} className="grid-line-h" style={{ top: `${value}%` }} />
          ))}
        </div>
      )}
      {h && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 5, pointerEvents: 'none' }}>
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} viewBox="0 0 100 100" preserveAspectRatio="none">
            {/* Línea de captura (transparente y gruesa) para arrastrar todo el horizonte */}
            <line
              x1={x1 * 100} y1={y1 * 100} x2={x2 * 100} y2={y2 * 100}
              stroke="transparent" strokeWidth="8"
              vectorEffect="non-scaling-stroke"
              style={{ pointerEvents: 'auto', cursor: 'ns-resize' }}
              onPointerDown={(e) => beginDrag(e, 'body')}
            />
            <line
              x1={x1 * 100} y1={y1 * 100} x2={x2 * 100} y2={y2 * 100}
              stroke="var(--color-text-muted)" strokeWidth="0.5"
              strokeDasharray="3 3" vectorEffect="non-scaling-stroke" opacity="0.8"
            />
          </svg>
          {/* Extremo izquierdo */}
          <div
            onPointerDown={(e) => beginDrag(e, 'left')}
            title="extremo izquierdo del horizonte: arrastralo para achicarlo o mover su altura"
            style={{
              position: 'absolute',
              left: `${x1 * 100}%`,
              top: `${y1 * 100}%`,
              width: 12,
              height: 12,
              transform: 'translate(-50%,-50%)',
              border: '1.5px solid var(--color-text)',
              borderRadius: '50%',
              background: '#fff',
              cursor: 'grab',
              pointerEvents: 'auto',
              zIndex: 6,
            }}
          />
          {/* Extremo derecho */}
          <div
            onPointerDown={(e) => beginDrag(e, 'right')}
            title="extremo derecho del horizonte: arrastralo para achicarlo o mover su altura"
            style={{
              position: 'absolute',
              left: `${x2 * 100}%`,
              top: `${y2 * 100}%`,
              width: 12,
              height: 12,
              transform: 'translate(-50%,-50%)',
              border: '1.5px solid var(--color-text)',
              borderRadius: '50%',
              background: '#fff',
              cursor: 'grab',
              pointerEvents: 'auto',
              zIndex: 6,
            }}
          />
          <span
            style={{
              position: 'absolute',
              left: `${((x1 + x2) / 2) * 100}%`,
              top: `${((y1 + y2) / 2) * 100}%`,
              transform: 'translate(-50%, -18px)',
              fontSize: 9,
              color: 'var(--color-text-muted)',
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            horizonte
          </span>
        </div>
      )}
    </>
  )
}