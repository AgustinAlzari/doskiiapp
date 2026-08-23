import { useRef, useState, useCallback, useEffect } from 'react'

export default function SignatureBlock({ signature, color, text, imagePath, isSelected, onSelect, onMove, onResize, onRemove }) {
  const blockRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [resizing, setResizing] = useState(false)
  const [preview, setPreview] = useState(null)
  const dragStart = useRef({ mx: 0, my: 0, x: 0, y: 0 })
  const resizeStart = useRef({ mx: 0, my: 0, w: 0, h: 0 })
  const isResizingRef = useRef(false)

  useEffect(() => {
    let active = true
    if (imagePath && window.api?.references) {
      window.api.references.read(imagePath).then(url => { if (active) setPreview(url) })
    } else setPreview(null)
    return () => { active = false }
  }, [imagePath])

  const handleMouseDown = useCallback((e) => {
    if (isResizingRef.current) return
    e.stopPropagation()
    onSelect()
    setDragging(true)
    dragStart.current = { mx: e.clientX, my: e.clientY, x: signature.x, y: signature.y }

    const handleMove = (ev) => {
      const canvas = blockRef.current?.parentElement
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const dx = (ev.clientX - dragStart.current.mx) / rect.width
      const dy = (ev.clientY - dragStart.current.my) / rect.height
      onMove(
        Math.max(0, Math.min(1 - signature.width, dragStart.current.x + dx)),
        Math.max(0, Math.min(1 - signature.height, dragStart.current.y + dy))
      )
    }
    const handleUp = () => {
      setDragging(false)
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
  }, [signature, onSelect, onMove])

  const handleResizeDown = useCallback((e, corner) => {
    e.stopPropagation()
    isResizingRef.current = true
    setResizing(true)
    resizeStart.current = { mx: e.clientX, my: e.clientY, x: signature.x, y: signature.y, w: signature.width, h: signature.height }

    const handleMove = (ev) => {
      const canvas = blockRef.current?.parentElement
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const dx = (ev.clientX - resizeStart.current.mx) / rect.width
      const dy = (ev.clientY - resizeStart.current.my) / rect.height
      const left = corner.includes('left')
      const top = corner.includes('top')
      const width = Math.max(0.05, Math.min(1, resizeStart.current.w + (left ? -dx : dx)))
      const height = Math.max(0.04, Math.min(1, resizeStart.current.h + (top ? -dy : dy)))
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
  }, [signature, onResize])

  const resizeHandle = (corner, style) => (
    <div onPointerDown={e => handleResizeDown(e, corner)} style={{ position: 'absolute', width: 12, height: 12, cursor: corner === 'top-left' || corner === 'bottom-right' ? 'nwse-resize' : 'nesw-resize', background: 'var(--color-border)', opacity: 0.65, zIndex: 21, ...style }} />
  )

  const border = color || 'var(--color-text)'

  return (
    <div
      ref={blockRef}
      className={`signature-block ${isSelected ? 'selected' : ''} ${dragging ? 'dragging' : ''}`}
      style={{ left: `${signature.x * 100}%`, top: `${signature.y * 100}%`, width: `${signature.width * 100}%`, height: `${signature.height * 100}%`, borderColor: border, zIndex: isSelected ? 9999 : 13 + (signature.z ?? 0) }}
      onMouseDown={handleMouseDown}
      title="firma"
    >
      {preview ? (
        <img src={preview} alt="firma" style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none', userSelect: 'none' }} />
      ) : (
        <div className="signature-block-text" style={{ color: border }}>
          {text || 'firma'}
        </div>
      )}
      {onRemove && <button className="block-remove-btn" onClick={e => { e.stopPropagation(); onRemove(); }} title="quitar firma">{'\u00D7'}</button>}
      {resizeHandle('top-left', { top: 0, left: 0 })}
      {resizeHandle('top-right', { top: 0, right: 0 })}
      {resizeHandle('bottom-left', { bottom: 0, left: 0 })}
      {resizeHandle('bottom-right', { bottom: 0, right: 0 })}
    </div>
  )
}
