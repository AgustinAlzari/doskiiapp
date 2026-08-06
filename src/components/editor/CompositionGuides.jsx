export default function CompositionGuides({ grid = 'thirds', horizon, visible, onMoveHorizon }) {
  const positions = grid === 'halves' ? [50] : [33.333, 66.666]
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
      {horizon && (
        <div className="horizon-guide" style={{ top: `${horizon.y * 100}%` }} onPointerDown={e => {
          e.stopPropagation()
          const canvas = e.currentTarget.parentElement
          const move = event => {
            const rect = canvas.getBoundingClientRect()
            onMoveHorizon?.(Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)))
          }
          const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
          window.addEventListener('pointermove', move)
          window.addEventListener('pointerup', up)
        }}>
          <span>horizonte</span>
        </div>
      )}
    </>
  )
}
