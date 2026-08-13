import { useEffect, useState } from 'react'

const STATUS_UI = {
  idle: { label: 'hecho' },
  syncing: { label: 'sincronizando...' },
  pending: { label: 'pendiente' },
  offline: { label: 'sin conexión' },
  error: { label: 'error' },
  disabled: { label: 'desactivado' },
}

export default function Sidebar({ currentView, onNavigate, activeProject, onExitProject, onToggleMode }) {
  const [backupStatus, setBackupStatus] = useState(null)

  useEffect(() => {
    const api = window.api?.backup
    if (!api) return
    api.getStatus().then(setBackupStatus).catch(() => {})
    return api.onStatus(setBackupStatus)
  }, [])

  const statusMeta = STATUS_UI[backupStatus?.state] || { label: '...' }
  const navItems = [
    { id: 'strips', label: 'viñetas', active: ['strips', 'new-strip', 'editor', 'prompts'] },
    { id: 'characters', label: 'personajes', active: ['characters', 'new-character', 'edit-character'] },
    { id: 'backgrounds', label: 'fondos', active: ['backgrounds', 'new-background', 'edit-background'] },
    { id: 'objects', label: 'objetos', active: ['objects', 'new-object', 'edit-object'] },
    { id: 'balloons', label: 'globos', active: ['balloons', 'new-balloon', 'edit-balloon'] },
    { id: 'export', label: 'preview y export', active: ['export'], divider: true },
    { id: 'authors', label: 'autores', active: ['authors', 'new-author', 'edit-author'], divider: true },
    { id: 'projects', label: 'proyectos', active: ['projects'] },
    { id: 'modelo', label: 'modelos', active: ['modelo'], divider: true },
  ]

  const isActive = (item) => item.active.includes(currentView)

  return (
    <aside style={{
      width: 200,
      height: '100vh',
      background: 'var(--color-surface)',
      borderRight: '1px solid var(--color-border-muted)',
      display: 'flex',
      flexDirection: 'column',
       paddingTop: 48,
      paddingBottom: 16,
      paddingLeft: 12,
      paddingRight: 12,
      flexShrink: 0,
    }}>
      <div
        style={{
          fontSize: 18,
          fontWeight: 700,
          letterSpacing: '-0.02em',
          marginBottom: 8,
          paddingLeft: 12,
          color: 'var(--color-title)',
        }}
      >
        @doski
      </div>

      {activeProject && (
        <div
          className="sidebar-item"
          style={{ fontSize: 12, color: 'var(--color-text-muted)', justifyContent: 'space-between' }}
          onClick={() => onNavigate('edit-project')}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeProject.name}</span>
          <span style={{ color: 'var(--color-accent)' }}>✎</span>
        </div>
      )}

      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: activeProject ? 12 : 12 }}>
        {navItems.map((item, idx) => {
          const scoped = item.id !== 'projects' && item.id !== 'modelo'
          const disabled = scoped && !activeProject
          return (
            <div key={item.id}>
              {item.divider && (
                <div style={{ height: 1, background: 'var(--color-border-muted)', margin: '8px 4px 8px' }} />
              )}
              <div
                className={`sidebar-item ${isActive(item) ? 'active' : ''}`}
                style={disabled ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}
                onClick={() => { if (disabled) return; onNavigate(item.id) }}
              >
                {item.label}
              </div>
            </div>
          )
        })}
      </nav>

      {!activeProject && (
        <div style={{ paddingLeft: 12, fontSize: 12, color: 'var(--color-text-muted)', marginTop: 12 }}>
          abrí un proyecto o creá uno nuevo
        </div>
      )}

      <div style={{ flex: 1 }} />

      <div style={{ borderTop: '1px solid var(--color-border-muted)', paddingTop: 10, marginTop: 8 }}>
        {/* Switch maestro: sincronizar / no sincronizar */}
        <div className="radio-group" style={{ paddingLeft: 4 }}>
          <div
            className={`radio-pill ${backupStatus?.mode !== 'local' ? 'active' : ''}`}
            onClick={() => onToggleMode && onToggleMode('online')}
          >
            sincronizar
          </div>
          <div
            className={`radio-pill ${backupStatus?.mode === 'local' ? 'active' : ''}`}
            onClick={() => onToggleMode && onToggleMode('local')}
          >
            no sincronizar
          </div>
        </div>
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', paddingLeft: 12, marginTop: 6 }}>
          {backupStatus?.mode === 'local' ? 'apagado' : statusMeta.label}
          {backupStatus?.message && backupStatus.message !== statusMeta.label && backupStatus.mode !== 'local' ? ` · ${backupStatus.message}` : ''}
        </div>
      </div>
    </aside>
  )
}
