const ALIGNS = [
  { id: 'left', label: 'izq' },
  { id: 'center', label: 'centro' },
  { id: 'right', label: 'der' },
  { id: 'justify', label: 'just' },
]

// Controles de layout del texto de un globo: sliders de tamaño y posición del
// párrafo dentro del globo, más la alineación. Sin textarea: el texto se
// escribe directamente en el globo del lienzo.
export default function TextLayoutControls({ align = 'center', onAlignChange, fontSize = 1, onFontSize, textX = 0, onTextX, textY = 0, onTextY }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
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
  )
}