export default function Sidebar({ currentView, onNavigate, activeProject, onExitProject }) {
  const navItems = [
    { id: 'strips', label: 'viñetas', active: ['strips', 'new-strip', 'editor', 'prompts'] },
    { id: 'characters', label: 'personajes', active: ['characters', 'new-character', 'edit-character'] },
    { id: 'backgrounds', label: 'fondos', active: ['backgrounds', 'new-background', 'edit-background'] },
    { id: 'objects', label: 'objetos', active: ['objects', 'new-object', 'edit-object'] },
    { id: 'balloons', label: 'globos', active: ['balloons', 'new-balloon', 'edit-balloon'] },
    { id: 'authors', label: 'autores', active: ['authors', 'new-author', 'edit-author'], divider: true },
    { id: 'projects', label: 'proyectos', active: ['projects'] },
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
          const scoped = item.id !== 'projects'
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
    </aside>
  )
}
