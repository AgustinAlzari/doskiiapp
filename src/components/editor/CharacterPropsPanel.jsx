import { ACTION_PRESETS, DIRECTIONS, DIRECTION_MODES, SHOT_TYPES } from '../../data/actionPresets'
import SpellCheckedTextarea from '../SpellCheckedTextarea'

export default function CharacterPropsPanel({ character, panelChar, panelCharacters, panelObjects, panelNarration, panelConnections, allCharacters, allObjects, defaultBalloonId, defaultSpeechBalloonId, defaultThoughtBalloonId, onAddDialogue, onUpdate, onRemove, onEdit }) {
  const actions = panelChar.actions || []

  const toggleAction = (action) => {
    const next = actions.includes(action)
      ? actions.filter(a => a !== action)
      : [...actions, action]
    onUpdate({ actions: next })
  }

  const removeAction = (action) => {
    onUpdate({ actions: actions.filter(a => a !== action) })
  }

  const otherPanelChars = (panelCharacters || []).filter(c => c.characterId !== panelChar.characterId)
  const panelObjs = (panelObjects || [])

  return (
    <div className="character-props-panel" style={{
      width: '100%',
      flexShrink: 0,
      paddingLeft: 16,
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
      overflow: 'auto',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="color-dot" style={{ background: character.color }} />
        <span style={{ fontWeight: 500, fontSize: 14 }}>{character.name}</span>
        <div style={{ flex: 1 }} />
        <button className="btn btn-ghost btn-sm" onClick={onEdit} style={{ fontSize: 11 }}>editar</button>
        <button className="btn btn-ghost btn-sm btn-danger" onClick={onRemove}>x</button>
      </div>

      {/* Comodín */}
      {character.comodin && (
        <div style={{ border: '1px dashed var(--color-border)', borderRadius: 8, padding: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <span className="color-dot" style={{ background: character.color }} />
            <span style={{ fontSize: 12, fontWeight: 600 }}>comodín — aparición única</span>
          </div>
          <SpellCheckedTextarea
            value={panelChar.comodinDesc || ''}
            onChange={e => onUpdate({ comodinDesc: e.target.value })}
            placeholder="qué es este personaje en este cuadro: ej. 'una laucha que habla'..."
            minRows={3}
          />
        </div>
      )}

      {/* Diálogo / pensamiento */}
      <div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
          <button className="btn btn-sm" onClick={() => onAddDialogue?.('speech')} style={{ fontSize: 11 }}>
            + diálogo
          </button>
          <button className="btn btn-sm" onClick={() => onAddDialogue?.('thought')} style={{ fontSize: 11 }}>
            + pensamiento
          </button>
        </div>
      </div>

      {/* Expression */}
      <div>
        <label className="label">expresión</label>
        <input
          className="input"
          value={panelChar.expression || ''}
          onChange={e => onUpdate({ expression: e.target.value })}
          placeholder="ceño fruncido, sonrisa..."
        />
      </div>

      {/* Direction */}
      <div>
        <label className="label">dirección</label>
        <div className="radio-group" style={{ flexWrap: 'wrap' }}>
          {DIRECTIONS.map(d => (
            <div
              key={d.id}
              className={`radio-pill ${panelChar.direction === d.id ? 'active' : ''}`}
              onClick={() => onUpdate({ direction: d.id })}
              title={d.name}
            >
              {d.label}
            </div>
          ))}
        </div>
        <div style={{ marginTop: 8 }}>
          <label className="label">aplicar a</label>
          <div className="radio-group" style={{ flexWrap: 'wrap' }}>
            {DIRECTION_MODES.map(m => {
              const hasGazeArrow = (panelConnections || []).some(c => c.from === panelChar.characterId)
              const disabled = hasGazeArrow && m.id !== 'body'
              return (
                <div
                  key={m.id}
                  className={`radio-pill ${(panelChar.directionMode || 'body') === m.id ? 'active' : ''}`}
                  style={disabled ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}
                  onClick={() => { if (disabled) return; onUpdate({ directionMode: m.id }) }}
                  title={disabled ? 'la flecha de mirada define la mirada: solo puede ser cuerpo' : m.label}
                >
                  {m.label}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Encuadre (plano del personaje) */}
      <div>
        <label className="label">encuadre (plano del personaje)</label>
        <div className="radio-group" style={{ flexWrap: 'wrap' }}>
          {SHOT_TYPES.filter(st => st.scope === 'character').map(st => (
            <div
              key={st.id}
              className={`radio-pill ${panelChar.framing === st.id ? 'active' : ''}`}
              onClick={() => onUpdate({ framing: panelChar.framing === st.id ? null : st.id })}
              title={st.desc}
            >
              {st.label}
            </div>
          ))}
        </div>
      </div>

      {/* Gaze target */}
      <div>
        <label className="label">mirada</label>
        <div className="radio-group">
          {otherPanelChars.map(c => {
            const def = allCharacters.find(ch => ch.id === c.characterId)
            return (
              <div
                key={c.characterId}
                className={`radio-pill ${panelChar.gazeTarget?.type === 'character' && panelChar.gazeTarget?.id === c.characterId ? 'active' : ''}`}
                onClick={() => onUpdate({ gazeTarget: panelChar.gazeTarget?.type === 'character' && panelChar.gazeTarget?.id === c.characterId ? null : { type: 'character', id: c.characterId } })}
                title={def?.name}
              >
                {def?.name || '?'}
              </div>
            )
          })}
          {panelObjs.map(o => {
            const def = allObjects.find(ob => ob.id === o.objectId)
            return (
              <div
                key={o.objectId}
                className={`radio-pill ${panelChar.gazeTarget?.type === 'object' && panelChar.gazeTarget?.id === o.objectId ? 'active' : ''}`}
                onClick={() => onUpdate({ gazeTarget: panelChar.gazeTarget?.type === 'object' && panelChar.gazeTarget?.id === o.objectId ? null : { type: 'object', id: o.objectId } })}
                title={def?.name}
              >
                {def?.name || '?'}
              </div>
            )
          })}
          {panelNarration && (
            <div
              className={`radio-pill ${panelChar.gazeTarget?.type === 'narration' ? 'active' : ''}`}
              onClick={() => onUpdate({ gazeTarget: panelChar.gazeTarget?.type === 'narration' ? null : { type: 'narration', id: 'narration' } })}
              title="narración"
            >
              narración
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div>
        <label className="label">acciones</label>
        {actions.length > 0 && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
            {actions.map(action => (
              <span key={action} className="radio-pill active" style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                {action}
                <span style={{ cursor: 'pointer', fontWeight: 700 }} onClick={() => removeAction(action)}>×</span>
              </span>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {ACTION_PRESETS.map(action => (
            <label key={action} className="check-item">
              <div
                className={`check-box ${actions.includes(action) ? 'checked' : ''}`}
                onClick={() => toggleAction(action)}
              />
              <span>{action}</span>
            </label>
          ))}
        </div>
        <SpellCheckedTextarea
          value={panelChar.actionNotes || ''}
          onChange={e => onUpdate({ actionNotes: e.target.value })}
          placeholder="descripción detallada de la acción..."
          minRows={4}
          maxRows={4}
          style={{ width: '100%' }}
        />
      </div>
    </div>
  )
}