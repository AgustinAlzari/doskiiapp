import { useState } from 'react'
import { ACTION_PRESETS, DIALOGUE_TYPES, DIRECTIONS } from '../../data/actionPresets'
import AutoTextarea from './AutoTextarea'

export default function CharacterPropsPanel({ character, panelChar, panelCharacters, panelObjects, panelNarration, allCharacters, allObjects, onUpdate, onRemove, onEdit }) {
  const actions = panelChar.actions || []
  const [customAction, setCustomAction] = useState('')

  const toggleAction = (action) => {
    const next = actions.includes(action)
      ? actions.filter(a => a !== action)
      : [...actions, action]
    onUpdate({ actions: next })
  }

  const addCustomAction = () => {
    if (customAction.trim() && !actions.includes(customAction.trim())) {
      onUpdate({ actions: [...actions, customAction.trim()] })
      setCustomAction('')
    }
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
        <button className="btn btn-ghost btn-sm btn-danger" onClick={onRemove}>×</button>
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
        <div className="radio-group">
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

      {/* Dialogue type */}
      <div>
        <label className="label">tipo de globo</label>
        <div className="radio-group">
          {DIALOGUE_TYPES.map(t => (
            <div
              key={t.id}
              className={`radio-pill ${panelChar.dialogueType === t.id ? 'active' : ''}`}
              onClick={() => onUpdate({ dialogueType: t.id })}
              title={t.label}
            >
              {t.icon}
            </div>
          ))}
        </div>
      </div>

      {/* Dialogue text */}
      <div>
        <label className="label">diálogo / pensamiento</label>
        <AutoTextarea
          value={panelChar.dialogue || ''}
          onChange={e => onUpdate({ dialogue: e.target.value })}
          placeholder="qué dice o piensa..."
          minRows={2}
        />
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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
          {ACTION_PRESETS.map(action => (
            <label key={action} className="check-item">
              <div
                className={`check-box ${actions.includes(action) ? 'checked' : ''}`}
                onClick={() => toggleAction(action)}
              />
              <span>{action}</span>
            </label>
          ))}
          <div style={{ marginTop: 4, display: 'flex', gap: 4 }}>
            <input
              className="input"
              value={customAction}
              onChange={e => setCustomAction(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomAction() } }}
              placeholder="acción custom..."
              style={{ fontSize: 12, padding: '4px 8px' }}
            />
            <button className="btn btn-sm" onClick={addCustomAction} disabled={!customAction.trim()}>+</button>
          </div>
        </div>
      </div>
    </div>
  )
}
