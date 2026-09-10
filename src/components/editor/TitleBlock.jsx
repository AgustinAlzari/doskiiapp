import { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react'

export default function TitleBlock({ panelTitle, isSelected, onSelect, onMove, onResize, onRotate, onRemove, onText }) {
  const blockRef = useRef(null)
  const textRef = useRef(null)
  const [dragging, setDragging] = useState(false)
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
    const ta = textRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = ta.scrollHeight + 'px'
  }, [])

  useLayoutEffect(() => {
    autoGrow()
  }, [panelTitle.text, panelTitle.width, panelTitle.fontSize, autoGrow])

  const handleRotateDown = useCallback((e) => {
    e.stopPropagation()
    isRotatingRef.current = true
    setRotating(true)
    const rect = blockRef.current?.getBoundingClientRect()
    if (!rect) return
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const startAngle = Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI
    rotateStart.current = { angle: startAngle, rotation: panelTitle.rotation || 0 }
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
  }, [panelTitle.rotation, onRotate])

  const handleMouseDown = useCallback((e) => {
    if (e.target.tagName === 'BUTTON') return
    if (isResizingRef.current || isRotatingRef.current) return
    // allow drag from anywhere including textarea, but distinguish click vs drag
    const isTextArea = e.target.tagName === 'TEXTAREA'
    e.stopPropagation()
    onSelect()
    setDragging(true)
    const startX = e.clientX
    const startY = e.clientY
    let moved = false
    dragStart.current = { mx: e.clientX, my: e.clientY, x: panelTitle.x, y: panelTitle.y }

    const handleMove = (ev) => {
      if (!moved) {
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < 4) return
        moved = true
      }
      const canvas = blockRef.current?.parentElement
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const dx = (ev.clientX - dragStart.current.mx) / rect.width
      const dy = (ev.clientY - dragStart.current.my) / rect.height
      onMove(
        Math.max(-0.6, Math.min(1.6 - panelTitle.width, dragStart.current.x + dx)),
        Math.max(-0.6, Math.min(1.6 - panelTitle.height, dragStart.current.y + dy))
      )
    }
    const handleUp = () => {
      setDragging(false)
      if (!moved && e.target.tagName === 'TEXTAREA') {
        textRef.current?.focus()
      }
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
  }, [panelTitle, onSelect, onMove])

  const handleResizeDown = useCallback((e, corner) => {
    e.stopPropagation()
    isResizingRef.current = true
    setResizing(true)
    resizeStart.current = { mx: e.clientX, my: e.clientY, x: panelTitle.x, y: panelTitle.y, w: panelTitle.width, h: panelTitle.height }

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
  }, [panelTitle, onResize])

  const resizeHandle = (corner, style) => (
    <div onPointerDown={e => handleResizeDown(e, corner)} style={{ position: 'absolute', width: 12, height: 12, cursor: corner === 'top-left' || corner === 'bottom-right' ? 'nwse-resize' : 'nesw-resize', background: 'var(--color-border)', opacity: 0.65, zIndex: 21, borderRadius: 2, ...style }} />
  )

  const handleText = useCallback((e) => {
    onText?.(e.target.value)
    requestAnimationFrame(() => autoGrow())
  }, [onText, autoGrow])

  const isTransparent = !!panelTitle.transparent
  const bgColor = panelTitle.bgColor || null
  const textColor = panelTitle.textColor || null
  const hasBgColor = bgColor && /^#[0-9a-fA-F]{6}$/.test(bgColor)
  const hasTextColor = textColor && /^#[0-9a-fA-F]{6}$/.test(textColor)
  return (
    <div
      ref={blockRef}
      className={`narration-block ${isTransparent ? 'unframed' : 'framed'} ${isSelected ? 'selected' : ''} ${dragging ? 'dragging' : ''} ${rotating ? 'rotating' : ''}`}
      style={{
        left: `${panelTitle.x * 100}%`,
        top: `${panelTitle.y * 100}%`,
        width: `${panelTitle.width * 100}%`,
        height: `${panelTitle.height * 100}%`,
        minHeight: `${panelTitle.height * 100}%`,
        zIndex: isSelected ? 9999 : 3 + (panelTitle.z ?? 0),
        transform: `rotate(${panelTitle.rotation || 0}deg)`,
        transformOrigin: 'center center',
        border: isTransparent ? '1.5px dashed rgba(0,0,0,0.15)' : `1.5px solid ${hasTextColor ? textColor : 'var(--color-title)'}`,
        background: isTransparent ? 'transparent' : hasBgColor ? bgColor : 'var(--color-surface)',
        overflow: 'visible',
      }}
      onMouseDown={handleMouseDown}
    >
      <div className="char-block-header" style={{ background: hasTextColor ? textColor : 'var(--color-title)', color: 'white' }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 10, color: 'white' }}>
          título / cartel
        </span>
      </div>

      <textarea
          ref={textRef}
          className="narration-editor"
          value={panelTitle.text || ''}
          placeholder="título o cartel..."
          rows={1}
          onChange={handleText}
          onInput={() => requestAnimationFrame(() => autoGrow())}
          onFocus={() => onSelect?.()}
          spellCheck={false}
          style={{
            fontSize: `${Math.round(((panelTitle.fontSize ?? 1.2) * 14))}px`,
            fontWeight: 700,
            textAlign: panelTitle.align || 'center',
            overflow: 'hidden',
            height: 'auto',
            flex: 1,
            minHeight: 24,
            color: hasTextColor ? textColor : 'var(--color-title)',
            background: 'transparent',
          }}
        />

      {onRemove && <button className="block-remove-btn" onClick={e => { e.stopPropagation(); onRemove(); }} title="quitar título">{'\u00D7'}</button>}

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
      {/* Move handle at top center for easier dragging */}
      {isSelected && (
        <div
          onPointerDown={(e) => { e.stopPropagation(); handleMouseDown(e) }}
          title="arrastrar para mover"
          style={{
            position: 'absolute',
            top: -8,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 32,
            height: 8,
            borderRadius: 4,
            background: 'var(--color-border)',
            opacity: 0.6,
            cursor: 'grab',
            zIndex: 22,
          }}
        />
      )}
    </div>
  )
}
