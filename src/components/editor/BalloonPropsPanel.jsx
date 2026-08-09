import { DIALOGUE_TYPES } from '../../data/actionPresets'
import AutoTextarea from './AutoTextarea'

const ANCHOR_DIRECTIONS = ['bottom', 'left', 'right', 'top']

export default function BalloonPropsPanel({
  kind, label, characterName,
  text, channel, balloonId, balloons,
  anchor, panelCharacters, panelObjects, characters, objects,
  onText, onChannel, onBalloonId, onAnchor, onRemove, onClose,
}) {
  const anchorType = anchor?.type || 'none'

  const charName = (id) => {
    const pc = (panelCharacters || []).find(c => c.characterId === id)
    return pc ? (characters || []).find(c => c.id === pc.characterId)?.name || '?' : '?'
  }
  const objName = (id) => {
    const po = (panelObjects || []).find(o => o.objectId === id)
    return po ? (objects || []).find(o => o.id === po.objectId)?.name || '?' : '?'
  }

  return (
    <div className="character-props-panel" style={{ width: '100%', flexShrink: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 14, overflow: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontWeight: 500, fontSize: 14 }}>
          {kind === 'dialogue' ? `globo ${label}` : `globo X ${label}`}
        </span>
        {characterName && <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>· {characterName}</span>}
        <div style={{ flex: 1 }} />
        <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ fontSize: 11 }}>cerrar</button>
        <button className="btn btn-ghost btn-sm btn-danger" onClick={onRemove}>×</button>
      </div>

      <div>
        <label className="label">texto</label>
        <AutoTextarea
          value={text}
          onChange={e => onText(e.target.value)}
          placeholder={kind === 'dialogue' ? 'qué dice o piensa...' : 'texto de este globo...'}
          minRows={2}
        />
      </div>

      <div>
        <label className="label">canal</label>
        <div className="radio-group">
          {DIALOGUE_TYPES.map(t => (
            <div
              key={t.id}
              className={`radio-pill ${channel === t.id ? 'active' : ''}`}
              onClick={() => onChannel(t.id)}
              title={t.label}
            >
              {t.icon}
            </div>
          ))}
        </div>
      </div>

      <div>
        <label className="label">estilo (entidad-globo)</label>
        <select className="input" value={balloonId || ''} onChange={e => onBalloonId(e.target.value || null)} style={{ fontSize: 12, cursor: 'pointer' }}>
          <option value="">(default del tipo)</option>
          {balloons.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>

      {kind === 'globox' && (
        <>
          <div>
            <label className="label">ancla de la cola</label>
            <select className="input" value={anchorType} onChange={e => onAnchor({ type: e.target.value, id: null, direction: null })} style={{ fontSize: 12, cursor: 'pointer' }}>
              <option value="none">sin cola (cartela flotante)</option>
              <option value="character">atado a un personaje</option>
              <option value="object">atado a un objeto</option>
              <option value="narration">atado a la narración</option>
              <option value="offpanel">desde afuera del panel</option>
            </select>
          </div>
          {anchorType === 'character' && (
            <div>
              <label className="label">personaje</label>
              <select className="input" value={anchor?.id || ''} onChange={e => onAnchor({ type: 'character', id: e.target.value, direction: null })} style={{ fontSize: 12, cursor: 'pointer' }}>
                <option value="">elegí...</option>
                {(panelCharacters || []).map(c => <option key={c.characterId} value={c.characterId}>{charName(c.characterId)}</option>)}
              </select>
            </div>
          )}
          {anchorType === 'object' && (
            <div>
              <label className="label">objeto</label>
              <select className="input" value={anchor?.id || ''} onChange={e => onAnchor({ type: 'object', id: e.target.value, direction: null })} style={{ fontSize: 12, cursor: 'pointer' }}>
                <option value="">elegí...</option>
                {(panelObjects || []).map(o => <option key={o.objectId} value={o.objectId}>{objName(o.objectId)}</option>)}
              </select>
            </div>
          )}
          {anchorType === 'offpanel' && (
            <div>
              <label className="label">dirección (de dónde sale la voz)</label>
              <div className="radio-group">
                {ANCHOR_DIRECTIONS.map(d => (
                  <div
                    key={d}
                    className={`radio-pill ${(anchor?.direction || 'bottom') === d ? 'active' : ''}`}
                    onClick={() => onAnchor({ type: 'offpanel', id: null, direction: d })}
                  >
                    {d}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
