import { useEffect, useState } from 'react'
import ChatLayout from './chat/ChatLayout'

function Step({ n, title, done, busy, busyText, error, children, action }) {
  return (
    <div className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-2)', width: 18, flexShrink: 0 }}>{n}</span>
        <span className="ui-h3" style={{ flex: 1 }}>{title}</span>
        {done && <span style={{ fontSize: 14, color: 'var(--color-text-muted)', flexShrink: 0 }}>✓</span>}
        {busy && <span style={{ fontSize: 12, color: 'var(--color-text-muted)', flexShrink: 0 }}>{busyText}</span>}
      </div>
      <div style={{ fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.4 }}>{children}</div>
      {error && <div style={{ fontSize: 12, color: 'var(--color-text-2)' }}>{error}</div>}
      {action && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {action}
        </div>
      )}
    </div>
  )
}

export default function SyncWizard({ onBack, onDone }) {
  const [diag, setDiag] = useState(null)
  const [busy, setBusy] = useState(null)
  const [progress, setProgress] = useState('')
  const [tested, setTested] = useState(false)
  const [testError, setTestError] = useState(null)
  const [synced, setSynced] = useState(false)
  const [error, setError] = useState(null)

  const loadDiag = async () => {
    try {
      if (window.api?.backup?.setupStatus) setDiag(await window.api.backup.setupStatus())
    } catch {}
  }

  useEffect(() => {
    loadDiag()
    return window.api?.backup?.onSetupProgress?.(setProgress)
  }, [])

  const run = async (name, fn) => {
    setBusy(name)
    setError(null)
    setProgress('')
    try {
      const res = await fn()
      if (res && res.ok === false && res.error) throw new Error(res.error)
      await loadDiag()
      if (name === 'test') {
        setTested(res?.ok !== false)
        setTestError(res?.ok === false ? (res.error || 'falló la conexión') : null)
      }
      if (name === 'sync') setSynced(true)
    } catch (e) {
      setError(String(e?.message || e))
      if (name === 'test') { setTested(false); setTestError(String(e?.message || e)) }
    } finally {
      setBusy(null)
    }
  }

  const install = () => run('install', () => window.api.backup.downloadRclone())
  const connect = () => run('connect', () => window.api.backup.createRemote())
  const test = () => run('test', () => window.api.backup.testConnection())
  const sync = () => run('sync', async () => {
    if (window.api?.backup?.syncNow) await window.api.backup.syncNow()
    if (window.api?.backup?.refresh) await window.api.backup.refresh()
    return { ok: true }
  })

  const rcloneOk = !!diag?.rcloneInstalled
  const remoteOk = !!diag?.remoteExists
  const allReady = rcloneOk && remoteOk && tested && synced

  return (
    <ChatLayout>
      <div style={{ maxWidth: 560 }}>
        <div className="section-header">
          <button className="back-arrow" onClick={onBack} title="volver">←</button>
          <h1 className="ui-h1">sincronización</h1>
        </div>
        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 16 }}>
          paso a paso para dejar la nube funcionando. cada paso se habilita cuando el anterior está listo.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Step
            n={1}
            title="rclone"
            done={rcloneOk}
            busy={busy === 'install'}
            busyText={progress || 'descargando...'}
            error={busy === 'install' ? error : null}
          >
            {rcloneOk
              ? <>rclone instalado {diag.rclonePath && `(${diag.rclonePath})`}</>
              : 'el programa que conecta con la nube. si falta, lo descargamos e instalamos automáticamente.'}
            {!rcloneOk && (
              <button className="btn" onClick={install} disabled={busy != null}>
                {busy === 'install' ? 'instalando...' : 'instalar rclone'}
              </button>
            )}
          </Step>

          <Step
            n={2}
            title="cuenta de google"
            done={remoteOk}
            busy={busy === 'connect'}
            busyText={progress || 'esperando autorización...'}
            error={busy === 'connect' ? error : null}
          >
            {remoteOk
              ? <>cuenta {diag.remoteName} conectada</>
              : 'la cuenta de google donde se guarda el respaldo. al conectar se abre el navegador para autorizar.'}
            {!remoteOk && rcloneOk && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn" onClick={connect} disabled={busy != null}>
                  {busy === 'connect' ? 'conectando...' : 'conectar con google'}
                </button>
                {busy === 'connect' && (
                  <button className="btn" onClick={() => window.api?.backup?.openRcloneConfig()} disabled={busy != null}>
                    hacerlo en la terminal
                  </button>
                )}
              </div>
            )}
          </Step>

          <Step
            n={3}
            title="conexión"
            done={tested}
            busy={busy === 'test'}
            busyText="probando..."
            error={busy === 'test' ? error : null}
          >
            {tested && !testError
              ? 'la conexión funciona'
              : testError
                ? `no conecta: ${testError}`
                : 'probá que la conexión con la nube funcione antes de sincronizar.'}
            {!tested && (
              <button className="btn" onClick={test} disabled={busy != null || !rcloneOk || !remoteOk}>
                {busy === 'test' ? 'probando...' : 'probar conexión'}
              </button>
            )}
          </Step>

          <Step
            n={4}
            title="primera sincronización"
            done={synced}
            busy={busy === 'sync'}
            busyText={progress || 'sincronizando...'}
            error={busy === 'sync' ? error : null}
          >
            {synced
              ? 'todo al día: se subió lo nuevo y se bajó lo más actual.'
              : 'sube todo lo nuevo a la nube y baja lo más actual de otras máquinas.'}
            {!synced && (
              <button className="btn" onClick={sync} disabled={busy != null || !tested}>
                {busy === 'sync' ? 'sincronizando...' : 'sincronizar ahora'}
              </button>
            )}
          </Step>

          {error && busy == null && (
            <div style={{ fontSize: 12, color: 'var(--color-text-2)' }}>{error}</div>
          )}

          {allReady && (
            <div className="card" style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: 14, color: 'var(--color-text-muted)', flex: 1 }}>
                ✓ todo listo. la nube queda encendida.
              </div>
              <button className="btn" onClick={onDone}>listo</button>
            </div>
          )}
        </div>
      </div>
    </ChatLayout>
  )
}
