import { useEffect, useState } from 'react'
import useStripStore from '../store/stripStore'

function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
  const day = d.getDate()
  const month = months[d.getMonth()]
  const year = d.getFullYear()
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${day} ${month} ${year}, ${h}:${m}`
}

function StripCover({ strip }) {
  const [src, setSrc] = useState(null)
  const result = strip.results?.[strip.resultCoverIndex]
  useEffect(() => {
    let active = true
    if (result?.path && window.api?.references) {
      window.api.references.read(result.path).then(url => { if (active) setSrc(url) })
    } else setSrc(null)
    return () => { active = false }
  }, [result?.path])

  if (!src) return null
  return (
    <div style={{ height: 120, border: '1px solid var(--color-border)', borderRadius: 6, overflow: 'hidden', marginBottom: 8, background: 'white' }}>
      <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
    </div>
  )
}

export default function StripList({ projectId, onNew, onEdit }) {
  const strips = useStripStore(s => s.strips)
  const loaded = useStripStore(s => s.loaded)
  const remove = useStripStore(s => s.remove)
  const scopedStrips = strips.filter(s => s.projectId === projectId)

  if (!loaded) return <div style={{ color: 'var(--color-text-muted)', padding: 24 }}>cargando...</div>

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}>viñetas</h1>
        <button className="btn btn-primary" onClick={onNew}>nueva viñeta</button>
      </div>

      {scopedStrips.length === 0 ? (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '64px 24px',
          gap: 16,
        }}>
          <div style={{ color: 'var(--color-text-muted)', fontSize: 14, textAlign: 'center' }}>
            sin viñetas aún. creá una para empezar.
          </div>
          <button className="btn btn-primary" onClick={onNew}>nueva viñeta</button>
        </div>
      ) : (
        <div className="strip-grid">
          {scopedStrips.map(strip => (
            <div
              key={strip.id}
              className="strip-card"
              onClick={() => onEdit(strip)}
            >
              <StripCover strip={strip} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontWeight: 600, fontSize: 15, lineHeight: 1.3 }}>
                  {strip.title || 'sin título'}
                </div>
                <button
                  className="btn btn-ghost btn-sm btn-danger"
                  style={{ flexShrink: 0 }}
                  onClick={(e) => { e.stopPropagation(); if (confirm('¿Eliminar?')) remove(strip.id) }}
                >
                  ×
                </button>
              </div>

              {strip.generalStyle && (
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
                  {strip.generalStyle}
                </div>
              )}

              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', lineHeight: 1.4, marginTop: 2 }}>
                {strip.createdAt && <span>creada {formatDate(strip.createdAt)}</span>}
                {strip.updatedAt && strip.updatedAt !== strip.createdAt && (
                  <span> · modif. {formatDate(strip.updatedAt)}</span>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: 8 }}>
                <div className="strip-card-dots">
                  {(strip.panels || []).slice(0, 10).map((p, i) => (
                    <div
                      key={p.id || i}
                      className={`strip-card-dot ${p.scene ? 'has-scene' : ''}`}
                      title={`cuadro ${i + 1}${p.scene ? ': ' + p.scene : ''}`}
                    />
                  ))}
                </div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                  {strip.panels?.length || 0} cuadros
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
