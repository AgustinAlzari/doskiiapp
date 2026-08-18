import { useRef, useState, useCallback } from 'react'

export default function SFXBlock({ sfx, isSelected, onSelect, onMove, onResize, onUpdate, onRemove }) {
  const blockRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [resizing, setResizing] = useState(false)
  const dragStart = useRef({ mx: 0, my: 0, x: 0, y: 0 })
  const resizeStart = useRef({ mx: 0, my: 0, w: 0, h: 0 })
  const isResizingRef = useRef(false)

  const handleMouseDown = useCallback((e) => {
    if (isResizingRef.current) return
    e.stopPropagation()
    onSelect()
    setDragging(true)
    dragStart.current = { mx: e.clientX, my: e.clientY, x: sfx.x, y: sfx.y }

    const handleMove = (ev) => {
      const canvas = blockRef.current?.parentElement
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const dx = (ev.clientX - dragStart.current.mx) / rect.width
      const dy = (ev.clientY - dragStart.current.my) / rect.height
      onMove(
        Math.max(-0.6, Math.min(1.6 - sfx.width, dragStart.current.x + dx)),
        Math.max(-0.6, Math.min(1.6 - sfx.height, dragStart.current.y + dy))
      )
    }
    const handleUp = () => {
      setDragging(false)
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
  }, [sfx, onSelect, onMove])

  const handleResizeDown = useCallback((e) => {
    e.stopPropagation()
    isResizingRef.current = true
    setResizing(true)
    resizeStart.current = { mx: e.clientX, my: e.clientY, w: sfx.width, h: sfx.height }

    const handleMove = (ev) => {
      const canvas = blockRef.current?.parentElement
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const dx = (ev.clientX - resizeStart.current.mx) / rect.width
      const dy = (ev.clientY - resizeStart.current.my) / rect.height
      onResize(
        Math.max(0.05, Math.min(0.5, resizeStart.current.w + dx)),
        Math.max(0.03, Math.min(0.4, resizeStart.current.h + dy))
      )
    }
    const handleUp = () => {
      isResizingRef.current = false
      setResizing(false)
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
  }, [sfx, onResize])

  const styleMap = {
    explosion: { fontWeight: 900, letterSpacing: '0.05em', transform: 'rotate(-5deg)' },
    impact:    { fontWeight: 800, fontStyle: 'italic' },
    whisper:   { fontWeight: 300, fontStyle: 'italic', opacity: 0.7 },
    speed:     { fontWeight: 700, letterSpacing: '0.15em', transform: 'skewX(-10deg)' },
    default:   { fontWeight: 700 },
  }

  const fontStyle = styleMap[sfx.style] || styleMap.default

  return (
    <div
      ref={blockRef}
      className={`sfx-block ${isSelected ? 'selected' : ''} ${dragging ? 'dragging' : ''}`}
      style={{
        left: `${sfx.x * 100}%`,
        top: `${sfx.y * 100}%`,
        width: `${sfx.width * 100}%`,
        height: `${sfx.height * 100}%`,
        zIndex: 14 + (sfx.z ?? 0),
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Asa de arrastre (mover como los otros frames) */}
      <div
        onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e) }}
        style={{
          position: 'absolute',
          top: -6,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 34,
          height: 8,
          cursor: 'grab',
          background: 'var(--color-border)',
          borderRadius: 999,
          opacity: 0.55,
          zIndex: 22,
        }}
        title="arrastrar para mover"
      />
      <input
        className="sfx-input"
        value={sfx.text}
        onChange={e => onUpdate({ text: e.target.value })}
        onMouseDown={e => e.stopPropagation()}
        style={fontToken(fontStyle)}
        placeholder="BAM"
      />

      {onRemove && <button className="block-remove-btn" onClick={e => { e.stopPropagation(); onRemove(); }} title="borrar onomatopeya">×</button>}

      <div
        onMouseDown={handleResizeDown}
        style={{
          position: 'absolute',
          bottom: 0,
          right: 0,
          width: 10,
          height: 10,
          cursor: 'nwse-resize',
          background: 'var(--color-border)',
          borderRadius: '2px 0 2px 0',
          opacity: 0.5,
        }}
      />
    </div>
  )
}

function fontToken(style) {
  return {
    width: '100%',
    height: '100%',
    border: 'none',
    background: 'transparent',
    textAlign: 'center',
    fontSize: 'inherit',
    outline: 'none',
    cursor: 'inherit',
    ...style,
  }
}
