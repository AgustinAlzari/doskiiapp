import { useEffect, useRef, useState } from 'react'

// Preview de imagen con fondo blanco (como el resto del programa).
// Flecha de retorno arriba a la izquierda. Barra mínima y centrada debajo de la imagen:
// ◀ anterior, −/+ zoom, "manito" para arrastrar dentro de la imagen, ▶ siguiente.
// Cierre fácil: ←, Esc o clic fuera.
export default function ImagePreview({ src, title, onClose, gallery, index, onIndex, actions }) {
  const hasGallery = Array.isArray(gallery) && gallery.length > 1
  const cur = hasGallery ? (gallery[index] || gallery[0]) : { src, title }

  const [scale, setScale] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const [panEnabled, setPanEnabled] = useState(true)
  const dragRef = useRef(null)
  const containerRef = useRef(null)

  // Al cambiar de imagen (galería), resetear zoom/pan.
  useEffect(() => {
    setScale(1)
    setPan({ x: 0, y: 0 })
  }, [index, cur.src])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      else if (hasGallery && e.key === 'ArrowLeft') onIndex?.(index - 1)
      else if (hasGallery && e.key === 'ArrowRight') onIndex?.(index + 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose, hasGallery, index])

  // Rueda del mouse (no pasiva) para que no scrollee el fondo.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onWheel = (e) => {
      e.preventDefault()
      zoomBy(e.deltaY < 0 ? 1.15 : 1 / 1.15)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const zoomBy = (factor) => {
    setScale(s => Math.min(8, Math.max(0.1, s * factor)))
  }
  const reset = () => { setScale(1); setPan({ x: 0, y: 0 }) }

  const onPointerDown = (e) => {
    if (!panEnabled) return
    dragRef.current = { startX: e.clientX, startY: e.clientY, px: pan.x, py: pan.y }
    setDragging(true)
  }
  const onPointerMove = (e) => {
    if (!dragRef.current) return
    const d = dragRef.current
    setPan({ x: d.px + (e.clientX - d.startX), y: d.py + (e.clientY - d.startY) })
  }
  const onPointerUp = () => { dragRef.current = null; setDragging(false) }

  const toolBtn = {
    minWidth: 34,
    height: 28,
    border: '1px solid var(--color-border)',
    borderRadius: 6,
    background: 'transparent',
    color: 'var(--color-text)',
    cursor: 'pointer',
    fontSize: 16,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#fff', zIndex: 10001, display: 'flex', flexDirection: 'column' }}>
      {/* Flecha de retorno: siempre arriba a la izquierda */}
      <button
        className="back-arrow"
        style={{ position: 'absolute', top: 10, left: 14, zIndex: 2 }}
        onClick={onClose}
        title="volver / cerrar (Esc)"
      >←</button>

      {/* Imagen */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: panEnabled ? (dragging ? 'grabbing' : 'grab') : 'default',
          touchAction: 'none',
          padding: '16px 24px',
        }}
        onClick={onClose}
      >
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
            transition: dragging ? 'none' : 'transform 0.1s ease',
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          onDoubleClick={(e) => { e.stopPropagation(); reset() }}
          onClick={(e) => e.stopPropagation()}
        >
          <img
            src={cur.src}
            alt=""
            draggable={false}
            style={{
              maxWidth: scale > 1 ? 'none' : '86vw',
              maxHeight: scale > 1 ? 'none' : '74vh',
              userSelect: 'none',
              pointerEvents: 'none',
            }}
          />
        </div>
      </div>

      {/* Barra de herramientas mínima, centrada debajo de la imagen */}
      <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'center', gap: 10, padding: '10px 0 18px' }}>
        {hasGallery && (
          <button style={toolBtn} title="anterior (←)" onClick={(e) => { e.stopPropagation(); onIndex?.(index - 1) }}>◀</button>
        )}
        <button style={toolBtn} title="alejar" onClick={(e) => { e.stopPropagation(); zoomBy(1 / 1.25) }}>−</button>
        <button
          style={{
            ...toolBtn,
            minWidth: 74,
            fontSize: 13,
            ...(panEnabled
              ? { background: 'var(--color-accent)', borderColor: 'var(--color-accent)', color: '#fff' }
              : {}),
          }}
          title={panEnabled ? 'arrastrar activado' : 'activar arrastrar dentro de la imagen'}
          onClick={(e) => { e.stopPropagation(); setPanEnabled(v => !v) }}
        >manito</button>
        <button style={toolBtn} title="acercar" onClick={(e) => { e.stopPropagation(); zoomBy(1.25) }}>+</button>
        {hasGallery && (
          <button style={toolBtn} title="siguiente (→)" onClick={(e) => { e.stopPropagation(); onIndex?.(index + 1) }}>▶</button>
        )}
        {Array.isArray(actions) && actions.length > 0 && (
          <span style={{ width: 1, alignSelf: 'stretch', background: 'var(--color-border-muted)' }} />
        )}
        {Array.isArray(actions) && actions.map(a => (
          <button
            key={a.label}
            style={{
              ...toolBtn,
              width: 'auto',
              padding: '0 12px',
              fontSize: 12,
              ...(a.active ? { background: 'var(--color-accent)', borderColor: 'var(--color-accent)', color: '#fff' } : {}),
            }}
            title={a.title}
            onClick={(e) => { e.stopPropagation(); a.onClick() }}
          >
            {a.label}
          </button>
        ))}
      </div>
    </div>
  )
}
