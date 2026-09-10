import { useRef, useState, useCallback } from 'react'
import useDoubleClick from './useDoubleClick'

export default function SFXBlock({ sfx, isSelected, onSelect, onMove, onResize, onRotate, onUpdate, onRemove, onDoubleClick }) {
  const blockRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [resizing, setResizing] = useState(false)
  const [rotating, setRotating] = useState(false)
  const dragStart = useRef({ mx: 0, my: 0, x: 0, y: 0 })
  const resizeStart = useRef({ mx: 0, my: 0, x: 0, y: 0, w: 0, h: 0 })
  const rotateStart = useRef({ angle: 0, rotation: 0 })
  const isResizingRef = useRef(false)
  const isRotatingRef = useRef(false)
  const detectDbl = useDoubleClick(onDoubleClick)

  const handleRotateDown = useCallback((e) => {
    e.stopPropagation()
    isRotatingRef.current = true
    setRotating(true)
    const rect = blockRef.current?.getBoundingClientRect()
    if (!rect) return
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const startAngle = Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI
    rotateStart.current = { angle: startAngle, rotation: sfx.rotation || 0 }
    const handleMove = (ev) => {
      const r = blockRef.current?.getBoundingClientRect()
      if (!r) return
      const ccx = r.left + r.width / 2
      const ccy = r.top + r.height / 2
      const curAngle = Math.atan2(ev.clientY - ccy, ev.clientX - ccx) * 180 / Math.PI
      let delta = curAngle - rotateStart.current.angle
      let next = (rotateStart.current.rotation + delta) % 360
      if (next > 180) next -= 360
      if (next < -180) next += 360
      onRotate?.(Math.round(next))
    }
    const handleUp = () => {
      isRotatingRef.current = false
      setRotating(false)
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
  }, [sfx.rotation, onRotate])

  const handleMouseDown = useCallback((e) => {
    if (isResizingRef.current || isRotatingRef.current) return
    if (detectDbl(e)) return
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
  }, [sfx, onSelect, onMove, detectDbl])

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
      className={`sfx-block ${isSelected ? 'selected' : ''} ${dragging ? 'dragging' : ''} ${rotating ? 'rotating' : ''}`}
      style={{
        left: `${sfx.x * 100}%`,
        top: `${sfx.y * 100}%`,
        width: `${sfx.width * 100}%`,
        height: `${sfx.height * 100}%`,
        zIndex: isSelected ? 9999 : 14 + (sfx.z ?? 0),
        transform: `rotate(${sfx.rotation || 0}deg)`,
        transformOrigin: 'center center',
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

      {isSelected && (
        <div
          onPointerDown={handleRotateDown}
          title="arrastrar para rotar"
          style={{
            position: 'absolute',
            top: -28,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: 'var(--color-bg)',
            border: '1.5px solid var(--color-border)',
            cursor: 'grab',
            zIndex: 23,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 10,
            lineHeight: 1,
            userSelect: 'none',
          }}
        >
          ↻
        </div>
      )}

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
