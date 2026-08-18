import { useEffect } from 'react'

export default function EntityImport({ kindLabel, candidates, onImport, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#fff', zIndex: 10000, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', borderBottom: '1px solid var(--color-border-muted)', flexShrink: 0 }}>
        <button className="back-arrow" onClick={onClose} title="volver (Esc)">←</button>
        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text)', whiteSpace: 'nowrap' }}>importar {kindLabel}</span>
        <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
          {candidates.length} {candidates.length === 1 ? 'proyecto' : 'proyectos'}
        </span>
        <div style={{ flex: 1 }} />
        <button className="btn btn-sm" onClick={onClose}>cerrar</button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        {candidates.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--color-text-muted)', padding: 40 }}>
            ningún otro proyecto tiene {kindLabel} para importar.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 480 }}>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
              los {kindLabel} del proyecto elegido reemplazan a los del proyecto actual (el comodín se conserva).
            </div>
            {candidates.map(p => (
              <button
                key={p.id}
                className="btn"
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', textAlign: 'left' }}
                onClick={() => onImport(p)}
                title={`traer los ${p.count} ${kindLabel} de este proyecto (sobreescribe)`}
              >
                <span>{p.name}</span>
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{p.count} {p.count === 1 ? 'elemento' : 'elementos'}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}