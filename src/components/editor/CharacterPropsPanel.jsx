import { useState } from 'react'
import { ACTION_PRESETS, DIRECTIONS, SHOT_TYPES } from '../../data/actionPresets'
import { orderedPanelDialogues } from '../../services/promptGenerator'
import AutoTextarea from './AutoTextarea'

export default function CharacterPropsPanel({ character, panelChar, panelCharacters, panelObjects, panelNarration, allCharacters, allObjects, defaultBalloonId, onUpdate, onRemove, onEdit }) {
  const actions = panelChar.actions || []
  const extraDialogues = panelChar.extraDialogues || []
  const [editingExtra, setEditingExtra] = useState(null)

  const dialogueNums = (() => {
    const list = orderedPanelDialogues({ characters: panelCharacters || [] }, allCharacters || [])
    const nums = { main: null, extras: {} }
    let mainLabel = null
    list.forEach(d => {
      if (d.characterId !== panelChar.characterId) return
      if (d.isExtra) nums.extras[d.extraIdx] = d.number
      else { nums.main = d.number; mainLabel = d.label }
    })
    nums.mainLabel = mainLabel
    return nums
  })()

  const setDialoguePreset = (pos) => {
    const width = panelChar.dialoguePos?.width || 0.26
    const height = panelChar.dialoguePos?.height || 0.1
    const x = panelChar.dialoguePos?.x ?? (panelChar.x + panelChar.width / 2 - width / 2)
    onUpdate({ dialoguePos: { x, y: pos === 'top' ? 0.02 : 0.88, width, height } })
  }

  const toggleAction = (action) => {
    const next = actions.includes(action)
      ? actions.filter(a => a !== action)
      : [...actions, action]
    onUpdate({ actions: next })
  }

  const removeAction = (action) => {
    onUpdate({ actions: actions.filter(a => a !== action) })
  }

  const addExtraDialogue = () => {
    const newDialogues = [...extraDialogues, { text: '', type: 'speech', balloonId: defaultBalloonId || null }]
    onUpdate({ extraDialogues: newDialogues })
    setEditingExtra(newDialogues.length - 1)
  }

  const updateExtraDialogue = (idx, updates) => {
    const newDialogues = extraDialogues.map((d, i) => i === idx ? { ...d, ...updates } : d)
    onUpdate({ extraDialogues: newDialogues })
  }

  const removeExtraDialogue = (idx) => {
    const newDialogues = extraDialogues.filter((_, i) => i !== idx)
    onUpdate({ extraDialogues: newDialogues })
    setEditingExtra(null)
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
          <AutoTextarea
            value={panelChar.comodinDesc || ''}
            onChange={e => onUpdate({ comodinDesc: e.target.value })}
            placeholder="qué es este personaje en este cuadro: ej. 'una laucha que habla'..."
            minRows={3}
          />
        </div>
      )}

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

      {/* Dialogue text + position */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <label className="label" style={{ marginBottom: 0 }}>
            diálogo / pensamiento {dialogueNums.main != null && <span style={{ color: 'var(--color-accent)' }}>· G{dialogueNums.main}</span>}
          </label>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              className={`btn btn-sm ${panelChar.dialoguePos?.y < 0.2 ? '' : 'btn-ghost'}`}
              onClick={() => setDialoguePreset('top')}
              style={{ fontSize: 10, padding: '2px 6px' }}
            >
              ↑ top
            </button>
            <button
              className={`btn btn-sm ${panelChar.dialoguePos?.y > 0.8 ? '' : 'btn-ghost'}`}
              onClick={() => setDialoguePreset('bottom')}
              style={{ fontSize: 10, padding: '2px 6px' }}
            >
              ↓ bottom
            </button>
          </div>
        </div>
        <AutoTextarea
          value={panelChar.dialogue || ''}
          onChange={e => onUpdate({ dialogue: e.target.value })}
          placeholder="qué dice o piensa..."
          minRows={2}
        />
        <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 4 }}>
          el globo {dialogueNums.mainLabel || `${character.name} 1`} en el lienzo es solo indicación gráfica: movelo y redimensionálo para diseñar; el texto va al prompt.
        </div>
      </div>

      {/* Extra dialogues */}
      {extraDialogues.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label className="label">diálogos extra</label>
          {extraDialogues.map((extra, idx) => (
            <div key={idx} style={{ border: '1px solid var(--color-border)', borderRadius: 6, padding: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                  línea {idx + 2}{dialogueNums.extras[idx] != null && <span style={{ color: 'var(--color-accent)' }}> · G{dialogueNums.extras[idx]}</span>}
                </span>
                <button className="btn btn-ghost btn-sm btn-danger" onClick={() => removeExtraDialogue(idx)} style={{ fontSize: 10 }}>×</button>
              </div>
              <AutoTextarea
                value={extra.text}
                onChange={e => updateExtraDialogue(idx, { text: e.target.value })}
                placeholder="siguiente línea de diálogo..."
                minRows={2}
              />
            </div>
          ))}
        </div>
      )}
      <button className="btn btn-sm btn-ghost" onClick={addExtraDialogue} style={{ fontSize: 11 }}>
        + agregar línea de diálogo
      </button>

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
        <AutoTextarea
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
