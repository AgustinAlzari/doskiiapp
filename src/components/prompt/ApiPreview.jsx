import { useState } from 'react'

export default function ApiPreview({ iterations = [], currentId, onSelect, onApprove, approvedId, onRefine, isGenerating }) {
  const current = iterations.find(it => it.id === currentId) || iterations[iterations.length - 1] || null
  if (!iterations.length) {
    return <div style={{ fontSize: 12, color: 'var(--color-text-muted)', padding: 12, border: '1px dashed var(--color-border)', borderRadius: 8 }}>todavía no generaste imágenes vía api</div>
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* timeline */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {iterations.map((it, idx) => (
          <button
            key={it.id}
            onClick={() => onSelect?.(it.id)}
            className="btn btn-sm"
            style={{
              borderColor: it.id === currentId ? 'var(--color-text)' : 'var(--color-border)',
              background: it.id === approvedId ? 'var(--color-text)' : 'transparent',
              color: it.id === approvedId ? '#fff' : 'var(--color-text)',
              fontSize: 11,
            }}
            title={it.promptText?.slice(0, 80)}
          >
            {idx + 1}{it.id === approvedId ? ' ✓' : ''}
          </button>
        ))}
      </div>

      {/* imagen actual */}
      {current && (
        <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 8, padding: 12, display: 'inline-block', alignSelf: 'flex-start', maxWidth: '100%' }}>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 6 }}>
            iteración {iterations.findIndex(it => it.id === current.id) + 1} · {current.model || 'muse-image-1.0'} · {current.usage ? `${current.usage.total_tokens || ''} tokens` : ''}
          </div>
          <div style={{ width: 360, height: 360, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--color-border)', borderRadius: 6, overflow: 'hidden' }}>
            {current.imageDataUrl ? <img src={current.imageDataUrl} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} /> : <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>sin imagen</span>}
          </div>
          {current.reasoning && (
            <details style={{ marginTop: 8 }}>
              <summary style={{ fontSize: 11, cursor: 'pointer' }}>razonamiento</summary>
              <div style={{ fontSize: 11, color: 'var(--color-text-2)', whiteSpace: 'pre-wrap', marginTop: 4 }}>{Array.isArray(current.reasoning) ? current.reasoning.map(r => r.text || JSON.stringify(r)).join('\n') : String(current.reasoning)}</div>
            </details>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexDirection: 'column' }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-sm" onClick={() => onApprove?.(current.id)} disabled={approvedId === current.id}>
                {approvedId === current.id ? 'aprobado ✓' : 'aprobar para diálogos'}
              </button>
            </div>
            {onRefine && (
              <RefineBox onRefine={onRefine} disabled={isGenerating} currentPrompt={current.promptText} />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function RefineBox({ onRefine, disabled, currentPrompt }) {
  const [text, setText] = useState('')
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--color-border-muted)' }}>
      <div style={{ fontSize: 11, fontWeight: 600 }}>refinar (corrección)</div>
      <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>describe qué corregir: pies, tamaño, calidad. se reenvía la imagen anterior + refs + layout.</div>
      <textarea className="input" value={text} onChange={e => setText(e.target.value)} placeholder="ej: respetar tamaño exacto del layout, pies iguales a la referencia, no deformar" style={{ minHeight: 60, fontSize: 12 }} />
      <div style={{ display: 'flex', gap: 6 }}>
        <button className="btn btn-sm" disabled={disabled || !text.trim()} onClick={() => { onRefine(text.trim()); setText('') }}>
          {disabled ? 'generando…' : 'refinar con corrección'}
        </button>
        <button className="btn btn-ghost btn-sm" disabled={disabled} onClick={() => onRefine('')} title="reintentar mismo prompt con más razonamiento">
          reintentar
        </button>
      </div>
    </div>
  )
}
