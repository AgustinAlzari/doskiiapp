import { useLayoutEffect, useRef, useState } from 'react'
import { markdownToHtml } from '../services/markdown'

function cloneTextareaStyles(el) {
  if (!el) return {}
  const cs = getComputedStyle(el)
  return {
    fontFamily: cs.fontFamily,
    fontSize: cs.fontSize,
    fontWeight: cs.fontWeight,
    lineHeight: cs.lineHeight,
    letterSpacing: cs.letterSpacing,
    paddingTop: cs.paddingTop,
    paddingRight: cs.paddingRight,
    paddingBottom: cs.paddingBottom,
    paddingLeft: cs.paddingLeft,
    borderTopWidth: cs.borderTopWidth,
    borderRightWidth: cs.borderRightWidth,
    borderBottomWidth: cs.borderBottomWidth,
    borderLeftWidth: cs.borderLeftWidth,
    boxSizing: cs.boxSizing,
  }
}

const ALIGNS = [
  { id: 'left', label: 'izq' },
  { id: 'center', label: 'centro' },
  { id: 'right', label: 'der' },
  { id: 'justify', label: 'just' },
]

// Textarea con sliders (tamaño de letra, X e Y del párrafo dentro del globo) y
// un backdrop que renderiza el markdown (negrita/cursiva, saltos de línea y
// alineación del bloque). El texto se guarda con los asteriscos visibles.
export default function MarkdownTextarea({ value, onChange, align = 'center', onAlignChange, fontSize = 1, onFontSize, textX = 0, onTextX, textY = 0, onTextY, placeholder, minRows = 2, maxRows = 20, className = 'input textarea', style = {} }) {
  const ref = useRef(null)
  const [backdropStyle, setBackdropStyle] = useState({})

  const adjustHeight = () => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    const lineHeight = parseInt(getComputedStyle(el).lineHeight) || 20
    const minH = minRows * lineHeight
    const maxH = maxRows * lineHeight
    el.style.height = Math.min(Math.max(el.scrollHeight, minH), maxH) + 'px'
  }

  useLayoutEffect(() => {
    adjustHeight()
    setBackdropStyle(cloneTextareaStyles(ref.current))
  }, [value, className])

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, color: 'var(--color-text-muted)', width: 70, flexShrink: 0 }}>tamaño</span>
          <input
            type="range"
            className="size-slider"
            min="0.6"
            max="1.6"
            step="0.05"
            value={fontSize ?? 1}
            onChange={e => onFontSize?.(Number(e.target.value))}
            title="tamaño de la letra dentro del globo"
            style={{ flex: 1 }}
          />
          <span style={{ fontSize: 10, color: 'var(--color-text-muted)', width: 30, textAlign: 'right', flexShrink: 0 }}>{Math.round((fontSize ?? 1) * 100)}%</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, color: 'var(--color-text-muted)', width: 70, flexShrink: 0 }}>x del párrafo</span>
          <input
            type="range"
            className="size-slider"
            min="-0.3"
            max="0.3"
            step="0.01"
            value={textX ?? 0}
            onChange={e => onTextX?.(Number(e.target.value))}
            title="mover el párrafo horizontalmente dentro del globo"
            style={{ flex: 1 }}
          />
          <span style={{ fontSize: 10, color: 'var(--color-text-muted)', width: 30, textAlign: 'right', flexShrink: 0 }}>{Math.round((textX ?? 0) * 100)}%</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, color: 'var(--color-text-muted)', width: 70, flexShrink: 0 }}>y del párrafo</span>
          <input
            type="range"
            className="size-slider"
            min="-0.3"
            max="0.3"
            step="0.01"
            value={textY ?? 0}
            onChange={e => onTextY?.(Number(e.target.value))}
            title="mover el párrafo verticalmente dentro del globo"
            style={{ flex: 1 }}
          />
          <span style={{ fontSize: 10, color: 'var(--color-text-muted)', width: 30, textAlign: 'right', flexShrink: 0 }}>{Math.round((textY ?? 0) * 100)}%</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>alineación:</span>
          {ALIGNS.map(a => (
            <span
              key={a.id}
              className={`radio-pill ${align === a.id ? 'active' : ''}`}
              style={{ fontSize: 10, cursor: 'pointer' }}
              onClick={() => onAlignChange?.(a.id)}
              title={`alinear ${a.label}`}
            >
              {a.label}
            </span>
          ))}
        </div>
      </div>
      <div style={{ position: 'relative' }}>
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            overflow: 'hidden',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            overflowWrap: 'break-word',
            textAlign: align,
            color: 'var(--color-text)',
            pointerEvents: 'none',
            ...backdropStyle,
          }}
          dangerouslySetInnerHTML={{ __html: markdownToHtml(value) || ' ' }}
        />
        <textarea
          ref={ref}
          className={className}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          rows={minRows}
          style={{
            position: 'relative',
            overflow: 'hidden',
            resize: 'none',
            background: 'transparent',
            color: 'transparent',
            caretColor: 'var(--color-text)',
            ...style,
          }}
        />
      </div>
    </div>
  )
}