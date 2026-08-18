import { useEffect } from 'react'
import useConfirmStore from '../store/confirmStore'

export default function ConfirmDialog() {
  const open = useConfirmStore(s => s.open)
  const message = useConfirmStore(s => s.message)
  const confirmLabel = useConfirmStore(s => s.confirmLabel)
  const respond = useConfirmStore(s => s.respond)

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') respond(false)
      else if (e.key === 'Enter' && document.activeElement?.tagName !== 'BUTTON') respond(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, respond])

  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.35)',
        zIndex: 20003,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
      onClick={() => respond(false)}
    >
      <div
        className="card"
        style={{ maxWidth: 440, width: '100%', padding: 16 }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <button className="back-arrow" onClick={() => respond(false)} title="cancelar (Esc)">←</button>
          <h2 className="ui-h2">confirmar</h2>
        </div>
        <div style={{ fontSize: 13, color: 'var(--color-text-2)', lineHeight: 1.5 }}>
          {message}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button className="btn" onClick={() => respond(false)}>cancelar</button>
          <button className="btn btn-primary" onClick={() => respond(true)}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}