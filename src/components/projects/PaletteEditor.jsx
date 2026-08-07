import { COLOR_MODES, PALETTE_ROLES } from '../../store/projectStore'

export default function PaletteEditor({ palette, colorMode, onModeChange, onPaletteChange }) {
  const colors = palette || []

  const updateColor = (id, updates) => {
    onPaletteChange(colors.map(c => c.id === id ? { ...c, ...updates } : c))
  }

  const addColor = () => {
    onPaletteChange([...colors, { id: crypto.randomUUID(), hex: '#111111', role: 'line', label: '' }])
  }

  const removeColor = (id) => {
    onPaletteChange(colors.filter(c => c.id !== id))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <label className="label">modo de color</label>
        <div className="radio-group">
          {COLOR_MODES.map(mode => (
            <div
              key={mode.id}
              className={`radio-pill ${colorMode === mode.id ? 'active' : ''}`}
              onClick={() => onModeChange(mode.id)}
              title={mode.label}
            >
              {mode.label}
            </div>
          ))}
        </div>
      </div>

      {colorMode !== 'bw' && (
        <>
          {colors.length > 0 && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {colors.filter(c => c.hex).map(c => (
                <div
                  key={c.id}
                  style={{ width: 20, height: 20, borderRadius: 4, background: c.hex, border: '1px solid var(--color-border)', cursor: 'pointer' }}
                  title={c.label || c.hex}
                  onClick={() => updateColor(c.id, { role: 'accent' })}
                />
              ))}
            </div>
          )}

          {colors.map(color => (
            <div key={color.id} style={{ border: '1px solid var(--color-border)', borderRadius: 6, padding: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="color"
                value={color.hex}
                onChange={e => updateColor(color.id, { hex: e.target.value })}
                style={{ width: 30, height: 30, border: 'none', borderRadius: 4, cursor: 'pointer', padding: 0, flexShrink: 0 }}
              />
              <select
                className="input"
                value={color.role}
                onChange={e => updateColor(color.id, { role: e.target.value })}
                style={{ fontSize: 11, cursor: 'pointer', flexShrink: 0 }}
              >
                {PALETTE_ROLES.map(role => (
                  <option key={role.id} value={role.id}>{role.label}</option>
                ))}
              </select>
              <input
                className="input"
                value={color.label || ''}
                onChange={e => updateColor(color.id, { label: e.target.value })}
                placeholder="etiqueta (ej: rojo chaqueta)"
                style={{ fontSize: 11, flex: 1 }}
              />
              <button className="btn btn-ghost btn-sm btn-danger" onClick={() => removeColor(color.id)} style={{ fontSize: 10 }}>×</button>
            </div>
          ))}

          <button className="btn btn-sm btn-ghost" onClick={addColor} style={{ fontSize: 11, alignSelf: 'flex-start' }}>
            + agregar color
          </button>
        </>
      )}
    </div>
  )
}
