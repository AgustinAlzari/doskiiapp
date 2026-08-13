import { useState } from 'react'

// Al iniciar la app: ¿trabajás en línea (autobackup activo + descarga antes de abrir)
// o local (autobackup apagado, podés subir después con "sincronizar")?
export default function ModePrompt({ onChoose }) {
  const [dontAsk, setDontAsk] = useState(false)

  const choose = (mode) => {
    onChoose({ mode, prompted: dontAsk })
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#fff', zIndex: 10002, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ maxWidth: 460, width: '100%', padding: 24 }}>
        <div className="ui-h1" style={{ marginBottom: 6 }}>¿en línea o local?</div>
        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 20 }}>
          en línea: el backup sube solo y antes de abrir un proyecto se descarga la última versión desde la nube.
          local: el backup automático queda apagado (podés subir después con "sincronizar").
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button className="btn btn-sm" style={{ height: 44, fontSize: 14, justifyContent: 'flex-start', padding: '0 16px' }} onClick={() => choose('online')}>
            en línea — autobackup activo
          </button>
          <button className="btn btn-sm" style={{ height: 44, fontSize: 14, justifyContent: 'flex-start', padding: '0 16px' }} onClick={() => choose('local')}>
            local — autobackup apagado (subir después)
          </button>
        </div>

        <label className="check-item" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16 }}>
          <input type="checkbox" checked={dontAsk} onChange={e => setDontAsk(e.target.checked)} style={{ width: 16, height: 16, cursor: 'pointer' }} />
          <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>no volver a preguntar</span>
        </label>
      </div>
    </div>
  )
}
