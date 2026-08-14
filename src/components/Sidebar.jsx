import { useEffect, useRef, useState } from 'react'
import useChatStore from '../store/chatStore'
import doskiiIcon from '../assets/doskii_icon.png'

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
  const [logoWidth, setLogoWidth] = useState(0)
  const boxRef = useRef(null)
  const chatOpen = useChatStore(s => s.open)
  const toggleChat = useChatStore(s => s.toggle)

  useEffect(() => {
    const api = window.api?.backup
    if (!api) return
    api.getStatus().then(setBackupStatus).catch(() => {})
    return api.onStatus(setBackupStatus)
  }, [])

  // El ícono va centrado y un 40% más chico que el ancho del título.
  useEffect(() => {
    if (boxRef.current) setLogoWidth(Math.round(boxRef.current.offsetWidth * 0.6))
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
    { id: 'sync', label: 'sincronización', active: ['sync'], divider: true },
  ]

  const isActive = (item) => item.active.includes(currentView)

  const isLocal = backupStatus?.mode === 'local'

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
      <div ref={boxRef} style={{ marginBottom: 8 }}>
        <div style={{ paddingLeft: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <img
              src={doskiiIcon}
              alt=""
              draggable={false}
              style={{
                width: logoWidth,
                height: logoWidth,
                display: 'block',
                objectFit: 'contain',
              }}
            />
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                letterSpacing: '-0.02em',
                color: 'var(--color-title)',
                whiteSpace: 'nowrap',
              }}
            >
              doskii
            </div>
          </div>
        </div>
      </div>

      {activeProject && (
        <>
          <div style={{ height: 1, background: 'var(--color-border-muted)', margin: '8px 4px 8px' }} />
          <div
            className="sidebar-item"
            style={{ fontSize: 12, color: 'var(--color-text-muted)', justifyContent: 'space-between' }}
            onClick={() => onNavigate('edit-project')}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeProject.name}</span>
            <span style={{ color: 'var(--color-accent)' }}>✎</span>
          </div>
          <div style={{ height: 1, background: 'var(--color-border-muted)', margin: '8px 4px 8px' }} />
        </>
      )}

      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 0 }}>
        {navItems.map((item, idx) => {
          const scoped = item.id !== 'projects' && item.id !== 'modelo' && item.id !== 'sync'
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
        {/* chat ia: en la misma categoría que modelos (debajo, sin divider extra) */}
        <div style={{ marginTop: 2 }}>
          <div className={`btn ${chatOpen ? '' : 'btn-ghost'}`} style={{ width: '100%' }} onClick={toggleChat}>
            {chatOpen ? 'ocultar chat' : 'chat ia'}
          </div>
        </div>
      </nav>

      {!activeProject && (
        <div style={{ paddingLeft: 12, fontSize: 12, color: 'var(--color-text-muted)', marginTop: 12 }}>
          abrí un proyecto o creá uno nuevo
        </div>
      )}

      <div style={{ flex: 1 }} />

      <div style={{ borderTop: '1px solid var(--color-border-muted)', paddingTop: 10, marginTop: 8 }}>
        {/* Switch maestro: nube on/off (toggle deslizante, fondo transparente) */}
        <div
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px', cursor: 'pointer' }}
          onClick={() => onToggleMode && onToggleMode(isLocal ? 'online' : 'local')}
          title={isLocal ? 'encender sincronización' : 'apagar sincronización'}
        >
          <span style={{ fontSize: 12, color: 'var(--color-text-2)' }}>nube</span>
          <div
            style={{
              width: 34,
              height: 18,
              borderRadius: 9,
              border: '1px solid var(--color-border)',
              background: 'transparent',
              position: 'relative',
              flexShrink: 0,
              transition: 'border-color 0.12s ease',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: 2,
                left: isLocal ? 2 : 16,
                width: 12,
                height: 12,
                borderRadius: 6,
                background: isLocal ? 'var(--color-text-muted)' : 'var(--color-accent)',
                transition: 'left 0.15s ease, background 0.15s ease',
              }}
            />
          </div>
        </div>
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', paddingLeft: 12, marginTop: 6 }}>
          {isLocal ? 'apagado' : statusMeta.label}
          {backupStatus?.message && backupStatus.message !== statusMeta.label && !isLocal ? ` · ${backupStatus.message}` : ''}
        </div>
      </div>
    </aside>
  )
}
