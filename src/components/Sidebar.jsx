export default function Sidebar({ currentView, onNavigate }) {
  const navItems = [
    { id: 'strips', label: 'tiras' },
    { id: 'characters', label: 'personajes' },
    { id: 'backgrounds', label: 'fondos' },
    { id: 'objects', label: 'objetos' },
  ]

  const isEditor = currentView === 'editor' || currentView === 'new-strip'

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
      <div style={{
        fontSize: 18,
        fontWeight: 700,
        letterSpacing: '-0.02em',
        marginBottom: 32,
        paddingLeft: 12,
        color: 'var(--color-title)',
      }}>
        @doski
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {navItems.map(item => (
          <div
            key={item.id}
            className={`sidebar-item ${currentView === item.id ? 'active' : ''}`}
            onClick={() => onNavigate(item.id)}
          >
            {item.label}
          </div>
        ))}
      </nav>

      <div style={{ flex: 1 }} />

      {isEditor && (
        <div
          className="sidebar-item"
          style={{ color: 'var(--color-accent)' }}
          onClick={() => onNavigate('strips')}
        >
          ← volver
        </div>
      )}
    </aside>
  )
}
