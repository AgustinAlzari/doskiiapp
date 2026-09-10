import { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react'

export default function NarrationBlock({ panelNarr, isSelected, onSelect, onMove, onResize, onRotate, onRemove, onText }) {
  const blockRef = useRef(null)
  const textRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [resizing, setResizing] = useState(false)
  const [rotating, setRotating] = useState(false)
  const dragStart = useRef({ mx: 0, my: 0, x: 0, y: 0 })
  const resizeStart = useRef({ mx: 0, my: 0, x: 0, y: 0, w: 0, h: 0 })
  const rotateStart = useRef({ angle: 0, rotation: 0 })
  const isResizingRef = useRef(false)
  const isRotatingRef = useRef(false)

  useEffect(() => {
    if (isSelected && textRef.current) textRef.current.focus()
  }, [isSelected])

  const autoGrow = useCallback(() => {
    if (isResizingRef.current) return
    const ta = textRef.current
    const block = blockRef.current
    if (!ta || !block) return
    ta.style.height = 'auto'
    const scrollH = ta.scrollHeight
    ta.style.height = scrollH + 'px'
    const canvas = block.parentElement
    if (!canvas) return
    const canvasH = canvas.getBoundingClientRect().height
    if (!canvasH) return
    const header = block.querySelector('.char-block-header')
    const headerH = header ? header.offsetHeight : 0
    const neededPx = headerH + scrollH + 4
    const neededFrac = neededPx / canvasH
    if (neededFrac > (panelNarr.height || 0) + 0.005) {
      const clamped = Math.min(1.6, Math.max(0.06, neededFrac))
      if (Math.abs(clamped - (panelNarr.height || 0)) > 0.005) onResize({ height: clamped })
    }
  }, [panelNarr.height, onResize])

  useLayoutEffect(() => {
    autoGrow()
  }, [panelNarr.text, panelNarr.width, panelNarr.fontSize, panelNarr.textX, panelNarr.textY, panelNarr.align, autoGrow])

  useEffect(() => {
    const ta = textRef.current
    const block = blockRef.current
    if (!ta || !block) return
    const canvas = block.parentElement
    const ro = new ResizeObserver(() => autoGrow())
    ro.observe(ta)
    if (canvas) ro.observe(canvas)
    return () => ro.disconnect()
  }, [autoGrow])

  const handleRotateDown = useCallback((e) => {
    e.stopPropagation()
    isRotatingRef.current = true
    setRotating(true)
    const rect = blockRef.current?.getBoundingClientRect()
    if (!rect) return
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const startAngle = Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI
    rotateStart.current = { angle: startAngle, rotation: panelNarr.rotation || 0 }
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
  }, [panelNarr.rotation, onRotate])

  const handleMouseDown = useCallback((e) => {
    if (e.target.tagName === 'BUTTON') return
    if (e.target.tagName === 'TEXTAREA') return
    if (isResizingRef.current || isRotatingRef.current) return
    e.stopPropagation()
    onSelect()
    setDragging(true)
    dragStart.current = { mx: e.clientX, my: e.clientY, x: panelNarr.x, y: panelNarr.y }

    const handleMove = (ev) => {
      const canvas = blockRef.current?.parentElement
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const dx = (ev.clientX - dragStart.current.mx) / rect.width
      const dy = (ev.clientY - dragStart.current.my) / rect.height
      onMove(
        Math.max(-0.6, Math.min(1.6 - panelNarr.width, dragStart.current.x + dx)),
        Math.max(-0.6, Math.min(1.6 - panelNarr.height, dragStart.current.y + dy))
      )
    }
    const handleUp = () => {
      setDragging(false)
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
  }, [panelNarr, onSelect, onMove])

  const handleResizeDown = useCallback((e, corner) => {
    e.stopPropagation()
    isResizingRef.current = true
    setResizing(true)
    resizeStart.current = { mx: e.clientX, my: e.clientY, x: panelNarr.x, y: panelNarr.y, w: panelNarr.width, h: panelNarr.height }

    const handleMove = (ev) => {
      const canvas = blockRef.current?.parentElement
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const dx = (ev.clientX - resizeStart.current.mx) / rect.width
      const dy = (ev.clientY - resizeStart.current.my) / rect.height
      const left = corner.includes('left')
      const top = corner.includes('top')
      const width = Math.max(0.08, Math.min(1, resizeStart.current.w + (left ? -dx : dx)))
      const height = Math.max(0.06, Math.min(1, resizeStart.current.h + (top ? -dy : dy)))
      const x = Math.max(0, Math.min(1 - width, resizeStart.current.x + (left ? dx : 0)))
      const y = Math.max(0, Math.min(1 - height, resizeStart.current.y + (top ? dy : 0)))
      onResize({ x, y, width, height })
    }
    const handleUp = () => {
      isResizingRef.current = false
      setResizing(false)
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
  }, [panelNarr, onResize])

  const resizeHandle = (corner, style) => (
    <div onPointerDown={e => handleResizeDown(e, corner)} style={{ position: 'absolute', width: 12, height: 12, cursor: corner === 'top-left' || corner === 'bottom-right' ? 'nwse-resize' : 'nesw-resize', background: 'var(--color-border)', opacity: 0.65, zIndex: 21, ...style }} />
  )

  const handleText = useCallback((e) => {
    onText?.(e.target.value)
    requestAnimationFrame(() => autoGrow())
  }, [onText, autoGrow])

  return (
    <div
      ref={blockRef}
      className={`narration-block ${panelNarr.framed ? 'framed' : 'unframed'} ${isSelected ? 'selected' : ''} ${dragging ? 'dragging' : ''} ${rotating ? 'rotating' : ''}`}
      style={{
        left: `${panelNarr.x * 100}%`,
        top: `${panelNarr.y * 100}%`,
        width: `${panelNarr.width * 100}%`,
        minHeight: `${panelNarr.height * 100}%`,
        height: 'auto',
        zIndex: isSelected ? 9999 : 2 + (panelNarr.z ?? 0),
        transform: `rotate(${panelNarr.rotation || 0}deg)`,
        transformOrigin: 'center center',
      }}
      onMouseDown={handleMouseDown}
    >
      <div className="char-block-header">
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 10 }}>
          narración
        </span>
      </div>

      <textarea
          ref={textRef}
          className="narration-editor"
          value={panelNarr.text || ''}
          placeholder="texto del narrador..."
          rows={1}
          onChange={handleText}
          onInput={() => requestAnimationFrame(() => autoGrow())}
          onMouseDown={e => e.stopPropagation()}
          onPointerDown={e => e.stopPropagation()}
          onFocus={() => onSelect?.()}
          spellCheck={false}
          style={{
            fontSize: `${Math.round(((panelNarr.fontSize ?? 1) * 10))}px`,
            textAlign: panelNarr.align || 'center',
            paddingTop: '6px',
            paddingBottom: '6px',
            paddingLeft: `${Math.round(((panelNarr.textX ?? 0) * 40)) + 6}px`,
            paddingRight: `${Math.max(0, 6 - Math.round((panelNarr.textX ?? 0) * 40))}px`,
            transform: `translateY(${Math.round(((panelNarr.textY ?? 0) * 40))}px)`,
            overflow: 'hidden',
            height: 'auto',
          }}
        />

      {onRemove && <button className="block-remove-btn" onClick={e => { e.stopPropagation(); onRemove(); }} title="quitar narración">{'\u00D7'}</button>}

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

      {resizeHandle('top-left', { top: 0, left: 0 })}
      {resizeHandle('top-right', { top: 0, right: 0 })}
      {resizeHandle('bottom-left', { bottom: 0, left: 0 })}
      {resizeHandle('bottom-right', { bottom: 0, right: 0 })}
    </div>
  )
}