import TextLayoutControls from './TextLayoutControls'

const ANCHOR_DIRECTIONS = ['bottom', 'left', 'right', 'top']

// Panel del globo seleccionado: sliders de layout, tipo, y para diálogo los
// botones de conexión. El texto se escribe directamente en el globo del lienzo.
export default function BalloonPropsPanel({
  kind, label, characterName,
  text, balloonId, balloons, defaultBalloon,
  anchor, panelCharacters, panelObjects, characters, objects,
  align, onAlign,
  fontSize, onFontSize, textX, onTextX, textY, onTextY,
  linked, onLinked,
  speaksFirst, onSpeaksFirst,
  dialogueType, onDialogueType,
  onAddDialogue,
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

      {kind === 'dialogue' && (
        <>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-sm" onClick={() => onAddDialogue?.('speech')} style={{ fontSize: 11 }}>
              + diálogo
            </button>
            <button className="btn btn-sm" onClick={() => onAddDialogue?.('thought')} style={{ fontSize: 11 }}>
              + pensamiento
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span
              className={`radio-pill ${dialogueType !== 'thought' ? 'active' : ''}`}
              style={{ fontSize: 10, cursor: 'pointer' }}
              onClick={() => onDialogueType?.('speech')}
              title="tipo: diálogo"
            >
              diálogo
            </span>
            <span
              className={`radio-pill ${dialogueType === 'thought' ? 'active' : ''}`}
              style={{ fontSize: 10, cursor: 'pointer' }}
              onClick={() => onDialogueType?.('thought')}
              title="tipo: pensamiento"
            >
              pensamiento
            </span>
            <div style={{ flex: 1 }} />
            <button
              className={`btn btn-sm ${speaksFirst ? '' : 'btn-ghost'}`}
              onClick={() => onSpeaksFirst?.()}
              style={{ fontSize: 10, padding: '2px 6px' }}
            >
              {speaksFirst ? '✓ habla primero' : 'habla primero'}
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>conexión con el globo anterior:</span>
            <span
              className={`radio-pill ${linked !== false ? 'active' : ''}`}
              style={{ fontSize: 10, cursor: 'pointer' }}
              onClick={() => onLinked?.(true)}
              title="unir este globo al anterior del mismo personaje con el tubo conector"
            >
              conectado
            </span>
            <span
              className={`radio-pill ${linked === false ? 'active' : ''}`}
              style={{ fontSize: 10, cursor: 'pointer' }}
              onClick={() => onLinked?.(false)}
              title="dejar este globo separado del anterior (por ejemplo si cambia el tipo de globo)"
            >
              desconectado
            </span>
          </div>
        </>
      )}

      <TextLayoutControls
        align={align || 'center'}
        onAlignChange={onAlign}
        fontSize={fontSize}
        onFontSize={onFontSize}
        textX={textX}
        onTextX={onTextX}
        textY={textY}
        onTextY={onTextY}
      />

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