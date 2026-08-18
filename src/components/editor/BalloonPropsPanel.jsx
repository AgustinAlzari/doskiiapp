import SpellCheckedTextarea from '../SpellCheckedTextarea'

const ANCHOR_DIRECTIONS = ['bottom', 'left', 'right', 'top']

export default function BalloonPropsPanel({
  kind, label, characterName,
  text, balloonId, balloons, defaultBalloon,
  anchor, panelCharacters, panelObjects, characters, objects,
  onText, onType, onAnchor, onRemove, onClose,
}) {
  const anchorType = anchor?.type || 'none'
  const effectiveId = balloonId || defaultBalloon?.id || ''
  const effective = balloons.find(b => b.id === effectiveId)
  const isImageBalloon = effective?.kind === 'image'

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
        <button className="back-arrow" onClick={onClose} title="cerrar">←</button>
        <button className="btn btn-ghost btn-sm btn-danger" onClick={onRemove}>×</button>
      </div>

      <div>
        <label className="label">{isImageBalloon ? 'describe la imagen del globo' : 'texto'}</label>
        <SpellCheckedTextarea
          value={text}
          onChange={e => onText(e.target.value)}
          placeholder={isImageBalloon
            ? 'describí la escena que va dentro del globo (en vez de texto)...'
            : (kind === 'dialogue' ? 'qué dice o piensa...' : 'texto de este globo...')}
          minRows={2}
        />
      </div>

      <div>
        <label className="label">tipo de globo</label>
        <select
          className="input"
          value={effectiveId}
          onChange={e => {
            const ent = balloons.find(b => b.id === e.target.value)
            onType(e.target.value, ent?.kind || 'speech')
          }}
          style={{ fontSize: 12, cursor: 'pointer' }}
        >
          {balloons.length === 0 && <option value="">(sin globos cargados)</option>}
          {balloons.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
          {isImageBalloon
            ? `globo de imagen: ${effective.name}. Lleva una imagen en su interior, no texto.`
            : (effective ? `define el globo: ${effective.name}. Si es de pensamiento, se dibuja como nube.` : 'elegí un globo de la sección "globos".')}
        </div>
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
