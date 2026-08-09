import { useState, useCallback, useRef } from 'react'
import useStripStore from '../../store/stripStore'
import useCharacterStore from '../../store/characterStore'
import useBackgroundStore from '../../store/backgroundStore'
import useObjectStore from '../../store/objectStore'
import { SHOT_TYPES, HATCH_TYPES, TIME_TRANSITIONS, SFX_STYLES, ASPECT_RATIOS } from '../../data/actionPresets'
import PanelCanvas from './PanelCanvas'
import CharacterPropsPanel from './CharacterPropsPanel'
import AutoTextarea from './AutoTextarea'

export default function StripEditor({ strip, project, onBack, onEditCharacter, onShowPrompts }) {
  const save = useStripStore(s => s.save)
  const characters = useCharacterStore(s => s.characters)
  const backgrounds = useBackgroundStore(s => s.backgrounds)
  const objects = useObjectStore(s => s.objects)
  const [data, setData] = useState(strip)
  const [selectedPanelIdx, setSelectedPanelIdx] = useState(0)
  const [selectedCharIdx, setSelectedCharIdx] = useState(null)
  const [selectedObjIdx, setSelectedObjIdx] = useState(null)
  const [selectedSfxIdx, setSelectedSfxIdx] = useState(null)
  const [selectedNarr, setSelectedNarr] = useState(false)
  const [selectedBalloon, setSelectedBalloon] = useState(null)
  const [saveState, setSaveState] = useState(null)
  const [showDescModal, setShowDescModal] = useState(false)
  const [descDraft, setDescDraft] = useState('')
  const [gridVisible, setGridVisible] = useState(true)
  const canvasRef = useRef(null)

  const deselectAll = useCallback(() => {
    setSelectedCharIdx(null)
    setSelectedObjIdx(null)
    setSelectedSfxIdx(null)
    setSelectedNarr(false)
    setSelectedBalloon(null)
  }, [])

  const panel = data.panels[selectedPanelIdx]

  const updatePanel = useCallback((panelIdx, updates) => {
    setData(prev => {
      const panels = [...prev.panels]
      panels[panelIdx] = { ...panels[panelIdx], ...updates }
      return { ...prev, panels }
    })
  }, [])

  const toggleHorizon = useCallback(() => {
    updatePanel(selectedPanelIdx, { horizon: panel?.horizon ? null : { y: 0.5, description: '' } })
  }, [selectedPanelIdx, panel?.horizon, updatePanel])

  const updateCharacterInPanel = useCallback((panelIdx, charIdx, updates) => {
    setData(prev => {
      const panels = [...prev.panels]
      if (!panels[panelIdx]?.characters?.[charIdx]) return prev
      const characters = [...panels[panelIdx].characters]
      characters[charIdx] = { ...characters[charIdx], ...updates }
      panels[panelIdx] = { ...panels[panelIdx], characters }
      return { ...prev, panels }
    })
  }, [])

  const addCharacterToPanel = useCallback((panelIdx, characterId) => {
    setData(prev => {
      const panels = [...prev.panels]
      const characters = [...panels[panelIdx].characters]
      characters.push({
        characterId,
        x: 0.3,
        y: 0.2,
        width: 0.18,
        height: 0.6,
        direction: 'front',
        expression: '',
        dialogue: '',
        dialogueType: 'speech',
        dialoguePosition: null,
        extraDialogues: [],
        actions: [],
        actionNotes: '',
        gazeTarget: null,
      })
      panels[panelIdx] = { ...panels[panelIdx], characters }
      return { ...prev, panels }
    })
  }, [])

  const removeCharacterFromPanel = useCallback((panelIdx, charIdx) => {
    setData(prev => {
      const panels = [...prev.panels]
      const characters = panels[panelIdx].characters.filter((_, i) => i !== charIdx)
      panels[panelIdx] = { ...panels[panelIdx], characters }
      return { ...prev, panels }
    })
    setSelectedCharIdx(null)
  }, [])

  const setBackgroundForPanel = useCallback((panelIdx, backgroundId) => {
    setData(prev => {
      const panels = [...prev.panels]
      panels[panelIdx] = {
        ...panels[panelIdx],
        backgroundId,
        background: backgroundId ? (panels[panelIdx].background || { x: 0.05, y: 0.1, width: 0.9, height: 0.45 }) : null,
      }
      return { ...prev, panels }
    })
  }, [])

  const updateBackground = useCallback((panelIdx, updates) => {
    setData(prev => {
      const panels = [...prev.panels]
      const nextBackground = { ...panels[panelIdx].background, ...updates }
      if (updates.width) nextBackground.height = Math.min(0.8, Math.max(0.12, updates.width * 0.5))
      panels[panelIdx] = { ...panels[panelIdx], background: nextBackground }
      return { ...prev, panels }
    })
  }, [])

  const toggleObjectInPanel = useCallback((panelIdx, objectId) => {
    setData(prev => {
      const panels = [...prev.panels]
      const currentObjects = panels[panelIdx].objects || []
      const nextObjects = [...currentObjects, {
        objectId,
        x: 0.35 + (currentObjects.length % 3) * 0.08,
        y: 0.3 + (currentObjects.length % 2) * 0.08,
        width: 0.15,
        height: 0.15,
      }]
      panels[panelIdx] = { ...panels[panelIdx], objects: nextObjects }
      return { ...prev, panels }
    })
  }, [])

  const updateObjectInPanel = useCallback((panelIdx, objIdx, updates) => {
    setData(prev => {
      const panels = [...prev.panels]
      if (!panels[panelIdx]?.objects?.[objIdx]) return prev
      const objects = [...(panels[panelIdx].objects || [])]
      objects[objIdx] = { ...objects[objIdx], ...updates }
      panels[panelIdx] = { ...panels[panelIdx], objects }
      return { ...prev, panels }
    })
  }, [])

  const removeObjectFromPanel = useCallback((panelIdx, objIdx) => {
    setData(prev => {
      const panels = [...prev.panels]
      const objects = (panels[panelIdx].objects || []).filter((_, i) => i !== objIdx)
      panels[panelIdx] = { ...panels[panelIdx], objects }
      return { ...prev, panels }
    })
  }, [])

  // SFX
  const addSfxToPanel = useCallback((panelIdx) => {
    setData(prev => {
      const panels = [...prev.panels]
      const sfx = [...(panels[panelIdx].sfx || [])]
      sfx.push({
        text: '',
        x: 0.6,
        y: 0.1,
        width: 0.15,
        height: 0.1,
        style: 'default',
      })
      panels[panelIdx] = { ...panels[panelIdx], sfx }
      return { ...prev, panels }
    })
  }, [])

  const updateSfxInPanel = useCallback((panelIdx, sfxIdx, updates) => {
    setData(prev => {
      const panels = [...prev.panels]
      if (!panels[panelIdx]?.sfx?.[sfxIdx]) return prev
      const sfx = [...(panels[panelIdx].sfx || [])]
      sfx[sfxIdx] = { ...sfx[sfxIdx], ...updates }
      panels[panelIdx] = { ...panels[panelIdx], sfx }
      return { ...prev, panels }
    })
  }, [])

  const removeSfxFromPanel = useCallback((panelIdx, sfxIdx) => {
    setData(prev => {
      const panels = [...prev.panels]
      const sfx = (panels[panelIdx].sfx || []).filter((_, i) => i !== sfxIdx)
      panels[panelIdx] = { ...panels[panelIdx], sfx }
      return { ...prev, panels }
    })
    setSelectedSfxIdx(null)
  }, [])

  // Narration
  const addNarrationToPanel = useCallback((panelIdx) => {
    setData(prev => {
      const panels = [...prev.panels]
      panels[panelIdx] = {
        ...panels[panelIdx],
        narration: { text: '', x: 0.05, y: 0.02, width: 0.4, height: 0.12, framed: true },
      }
      return { ...prev, panels }
    })
    setSelectedNarr(true)
  }, [])

  const updateNarrationInPanel = useCallback((panelIdx, updates) => {
    setData(prev => {
      const panels = [...prev.panels]
      const narration = { ...panels[panelIdx].narration, ...updates }
      panels[panelIdx] = { ...panels[panelIdx], narration }
      return { ...prev, panels }
    })
  }, [])

  const removeNarrationFromPanel = useCallback((panelIdx) => {
    setData(prev => {
      const panels = [...prev.panels]
      panels[panelIdx] = { ...panels[panelIdx], narration: null }
      return { ...prev, panels }
    })
    setSelectedNarr(false)
  }, [])

  // Balloons (dialogue positions on canvas)
  const updateDialoguePos = useCallback((panelIdx, characterId, isExtra, extraIdx, updates) => {
    setData(prev => {
      const panels = [...prev.panels]
      const characters = [...(panels[panelIdx].characters || [])]
      const charIdx = characters.findIndex(c => c.characterId === characterId)
      if (charIdx < 0) return prev
      const char = characters[charIdx]
      if (isExtra) {
        const extras = [...(char.extraDialogues || [])]
        if (!extras[extraIdx]) return prev
        extras[extraIdx] = { ...extras[extraIdx], pos: { ...(extras[extraIdx].pos || {}), ...updates } }
        characters[charIdx] = { ...char, extraDialogues: extras }
      } else {
        characters[charIdx] = { ...char, dialoguePos: { ...(char.dialoguePos || {}), ...updates } }
      }
      panels[panelIdx] = { ...panels[panelIdx], characters }
      return { ...prev, panels }
    })
  }, [])

  const moveBalloon = useCallback((balloon, { x, y }) => {
    updateDialoguePos(selectedPanelIdx, balloon.characterId, balloon.isExtra, balloon.extraIdx, { x, y })
  }, [selectedPanelIdx, updateDialoguePos])

  const resizeBalloon = useCallback((balloon, updates) => {
    updateDialoguePos(selectedPanelIdx, balloon.characterId, balloon.isExtra, balloon.extraIdx, updates)
  }, [selectedPanelIdx, updateDialoguePos])

  const selectBalloon = useCallback((balloon) => {
    const charIdx = (panel?.characters || []).findIndex(c => c.characterId === balloon.characterId)
    if (charIdx < 0) return
    setSelectedCharIdx(charIdx)
    setSelectedObjIdx(null)
    setSelectedSfxIdx(null)
    setSelectedNarr(false)
    setSelectedBalloon({ characterId: balloon.characterId, isExtra: balloon.isExtra, extraIdx: balloon.extraIdx })
  }, [panel])

  const removeDialogueBalloon = useCallback((balloon) => {
    setData(prev => {
      const panels = [...prev.panels]
      const characters = [...(panels[selectedPanelIdx].characters || [])]
      const charIdx = characters.findIndex(c => c.characterId === balloon.characterId)
      if (charIdx < 0) return prev
      const char = characters[charIdx]
      if (balloon.isExtra) {
        characters[charIdx] = { ...char, extraDialogues: (char.extraDialogues || []).filter((_, i) => i !== balloon.extraIdx) }
      } else {
        characters[charIdx] = { ...char, dialogue: '', dialoguePos: null }
      }
      panels[selectedPanelIdx] = { ...panels[selectedPanelIdx], characters }
      return { ...prev, panels }
    })
    setSelectedBalloon(null)
    setSelectedCharIdx(null)
  }, [selectedPanelIdx])

  // Connections
  const addConnection = useCallback((panelIdx, fromId, toId, toType = 'character') => {
    setData(prev => {
      const panels = [...prev.panels]
      let connections = [...(panels[panelIdx].connections || [])]
      connections = connections.filter(c => c.from !== fromId)
      connections.push({ from: fromId, to: toId, toType })
      panels[panelIdx] = { ...panels[panelIdx], connections }
      return { ...prev, panels }
    })
  }, [])

  const removeConnection = useCallback((panelIdx, fromId, toId, toType = 'character') => {
    setData(prev => {
      const panels = [...prev.panels]
      const connections = (panels[panelIdx].connections || []).filter(c => !(c.from === fromId && c.to === toId && (c.toType || 'character') === toType))
      panels[panelIdx] = { ...panels[panelIdx], connections }
      return { ...prev, panels }
    })
  }, [])

  const handleSave = async () => {
    setSaveState('saving')
    await save(data)
    setSaveState('saved')
    setTimeout(() => setSaveState(null), 2000)
  }

  const selectedCharData = selectedCharIdx != null ? panel?.characters[selectedCharIdx] : null
  const selectedCharDef = selectedCharData ? characters.find(c => c.id === selectedCharData.characterId) : null
  const selectedSfxData = panel?.sfx?.[selectedSfxIdx]
  const selectedObjData = panel?.objects?.[selectedObjIdx]
  const selectedObjDef = selectedObjData && objects.find(item => item.id === selectedObjData.objectId)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div className="editor-header" style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 28, marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--color-border-muted)' }}>
        <button className="btn btn-ghost btn-sm" onClick={onBack}>←</button>
        <input
          className="input"
          value={data.title}
          onChange={e => setData(prev => ({ ...prev, title: e.target.value }))}
          placeholder="título..."
          style={{ flex: 1, fontWeight: 700, fontSize: 16, border: 'none', background: 'transparent', padding: 0 }}
        />
        <select
          className="time-pill"
          value={data.aspectRatio || 'hd'}
          onChange={e => setData(prev => ({ ...prev, aspectRatio: e.target.value }))}
          title="proporción del cuadro"
          style={{ flexShrink: 0, cursor: 'pointer' }}
        >
          {ASPECT_RATIOS.map(ar => <option key={ar.id} value={ar.id}>{ar.label} {ar.ratio}</option>)}
        </select>
        <button className="btn btn-sm" onClick={() => onShowPrompts(data, characters)}>
          prompts
        </button>
        <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saveState === 'saving'}>
          {saveState === 'saving' ? 'guardando...' : saveState === 'saved' ? 'guardado ✓' : 'guardar'}
        </button>
      </div>

      {/* Estilo general - Ficha Descripción */}
      <div style={{ marginBottom: 16, maxWidth: 820 }}>
        <label className="label">descripción</label>
        <div className="desc-card" onClick={() => { setDescDraft(data.generalStyle || ''); setShowDescModal(true) }}>
          <div className="desc-card-text">
            {data.generalStyle || 'describe el estilo visual de la tira...'}
          </div>
          <div className="desc-card-dots">···</div>
        </div>
        {project && (project.styleNotes || project.drawingStyle || project.genre) && (
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
            hereda del proyecto: {[project.drawingStyle, project.genre, project.styleNotes].filter(Boolean).join(' · ')}
            {data.generalStyle?.trim() ? ' (la descripción de la tira agrega o reemplaza)' : ' (vacío = usar estilo del proyecto)'}
          </div>
        )}
      </div>

      {/* Modal overlay de descripción */}
      {showDescModal && (
        <div className="desc-overlay" onClick={() => setShowDescModal(false)}>
          <div className="desc-modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>descripción de la tira</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowDescModal(false)} style={{ fontSize: 16, padding: '2px 8px' }}>×</button>
            </div>
            <AutoTextarea
              value={descDraft}
              onChange={e => setDescDraft(e.target.value)}
              placeholder="describe el estilo visual: Sempé, línea fina B&N, humor nórdico..."
              minRows={6}
              maxRows={16}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowDescModal(false)}>cerrar</button>
              <button className="btn btn-primary btn-sm" onClick={() => { setData(prev => ({ ...prev, generalStyle: descDraft })); setShowDescModal(false) }}>guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* Editor content */}
      <div style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0 }}>
          {/* Panel tabs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: 80, flexShrink: 0 }}>
            {data.panels.map((p, i) => (
              <div key={p.id}>
                {/* Time transition between panels */}
                {i > 0 && (
                  <div style={{ padding: '4px 0', display: 'flex', justifyContent: 'center' }}>
                    <select
                      className="time-pill"
                      value={p.timeTransition || ''}
                      onChange={e => updatePanel(i, { timeTransition: e.target.value || null })}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        fontSize: 10,
                        color: 'var(--color-text-muted)',
                        cursor: 'pointer',
                        padding: 0,
                        maxWidth: 80,
                      }}
                    >
                      <option value="">—</option>
                      {TIME_TRANSITIONS.map(t => (
                        <option key={t.id} value={t.id}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div
                  className={`sidebar-item ${i === selectedPanelIdx ? 'active' : ''}`}
                  style={{ justifyContent: 'center', fontSize: 12 }}
                  onClick={() => { setSelectedPanelIdx(i); setSelectedCharIdx(null); setSelectedObjIdx(null); setSelectedSfxIdx(null); setSelectedBalloon(null); setSelectedNarr(false) }}
                >
                  cuadro {i + 1}
                </div>
              </div>
            ))}
          </div>

          {/* Canvas + Sidebars */}
          <div style={{ display: 'flex', gap: 12, flex: '1 1 0%', minHeight: 0, position: 'relative' }}>
            {/* Canvas — fixed width, never shrinks */}
            <div style={{ position: 'relative', flex: '1 1 0%', minWidth: 0, overflow: 'hidden' }}>
              <PanelCanvas
                key={data.aspectRatio || 'hd'}
                panel={panel}
                characters={characters}
                backgrounds={backgrounds}
                objects={objects}
                aspectRatio={data.aspectRatio}
                grid={panel?.grid || 'thirds'}
                gridVisible={gridVisible}
                canvasRef={canvasRef}
                selectedCharIdx={selectedCharIdx}
                selectedObjIdx={selectedObjIdx}
                selectedSfxIdx={selectedSfxIdx}
                selectedBalloon={selectedBalloon}
                onSelectChar={(idx) => { setSelectedCharIdx(idx); setSelectedObjIdx(null); setSelectedSfxIdx(null); setSelectedBalloon(null) }}
                onSelectObj={(idx) => { setSelectedObjIdx(idx); setSelectedCharIdx(null); setSelectedSfxIdx(null); setSelectedBalloon(null) }}
                onSelectSfx={(idx) => { setSelectedSfxIdx(idx); setSelectedCharIdx(null); setSelectedObjIdx(null); setSelectedBalloon(null) }}
                selectedNarr={selectedNarr}
                onSelectNarr={() => { setSelectedNarr(true); setSelectedCharIdx(null); setSelectedObjIdx(null); setSelectedSfxIdx(null); setSelectedBalloon(null) }}
                onSelectBalloon={selectBalloon}
                onMoveBalloon={moveBalloon}
                onResizeBalloon={resizeBalloon}
                onRemoveBalloon={removeDialogueBalloon}
                onUpdateChar={(charIdx, updates) => updateCharacterInPanel(selectedPanelIdx, charIdx, updates)}
                onUpdateObj={(objIdx, updates) => updateObjectInPanel(selectedPanelIdx, objIdx, updates)}
                onUpdateSfx={(sfxIdx, updates) => updateSfxInPanel(selectedPanelIdx, sfxIdx, updates)}
                onRemoveChar={(charIdx) => removeCharacterFromPanel(selectedPanelIdx, charIdx)}
                onRemoveObj={(objIdx) => removeObjectFromPanel(selectedPanelIdx, objIdx)}
                onRemoveSfx={(sfxIdx) => removeSfxFromPanel(selectedPanelIdx, sfxIdx)}
                onUpdateNarr={(updates) => updateNarrationInPanel(selectedPanelIdx, updates)}
                onRemoveNarr={() => removeNarrationFromPanel(selectedPanelIdx)}
                onRemoveBackground={() => setBackgroundForPanel(selectedPanelIdx, null)}
                onUpdateBackground={(updates) => updateBackground(selectedPanelIdx, updates)}
                onUpdateHorizon={(updates) => updatePanel(selectedPanelIdx, { horizon: updates })}
                connections={panel?.connections || []}
                onAddConnection={(fromId, toId, toType) => addConnection(selectedPanelIdx, fromId, toId, toType)}
                onRemoveConnection={(fromId, toId) => removeConnection(selectedPanelIdx, fromId, toId)}
                onCanvasClick={deselectAll}
              />
            </div>

            {/* General sidebar — always fixed width, right side, relative container */}
            <div
              style={{ width: 360, flexShrink: 0, alignSelf: 'stretch', position: 'relative', overflow: 'hidden' }}
            >
              {/* Properties overlay — absolute, covers sidebar when active */}
              {(selectedCharData && selectedCharDef) || (selectedObjData && selectedObjDef) || (selectedSfxData && selectedSfxIdx !== null) ? (
                <div className="editor-sidebar" style={{ position: 'absolute', inset: 0, overflow: 'auto', zIndex: 5, background: 'var(--color-bg)' }}>
                  {selectedCharData && selectedCharDef && (
                    <CharacterPropsPanel
                      key={`char-${selectedCharIdx}`}
                      character={selectedCharDef}
                      panelChar={selectedCharData}
                      panelCharacters={panel?.characters || []}
                      panelObjects={panel?.objects || []}
                      panelNarration={panel?.narration}
                      allCharacters={characters}
                      allObjects={objects}
                      onUpdate={(updates) => updateCharacterInPanel(selectedPanelIdx, selectedCharIdx, updates)}
                      onRemove={() => removeCharacterFromPanel(selectedPanelIdx, selectedCharIdx)}
                      onEdit={() => onEditCharacter(selectedCharDef)}
                    />
                  )}
                  {selectedObjData && selectedObjDef && (
                    <div style={{ padding: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="color-dot" style={{ background: selectedObjDef.color }} />
                        <span style={{ fontWeight: 500, fontSize: 14 }}>{selectedObjDef.name}</span>
                        <div style={{ flex: 1 }} />
                        <button className="btn btn-ghost btn-sm btn-danger" onClick={() => setSelectedObjIdx(null)}>×</button>
                      </div>
                      <div style={{ marginTop: 12 }}>
                        {selectedObjDef.comodin && (
                          <div style={{ marginBottom: 12 }}>
                            <label className="label">qué es este objeto</label>
                            <AutoTextarea
                              value={selectedObjData.comodinDesc || ''}
                              onChange={e => updateObjectInPanel(selectedPanelIdx, selectedObjIdx, { comodinDesc: e.target.value })}
                              placeholder="ej. 'un microondas abandonado lleno de moscas'..."
                              minRows={3}
                            />
                          </div>
                        )}
                        <label className="label">sobre el objeto</label>
                        <AutoTextarea
                          value={selectedObjData.note || ''}
                          onChange={e => updateObjectInPanel(selectedPanelIdx, selectedObjIdx, { note: e.target.value })}
                          placeholder="qué ocurre sobre este objeto, qué contiene o qué relación tiene con la escena..."
                          minRows={4}
                        />
                      </div>
                    </div>
                  )}
                  {selectedSfxData && selectedSfxIdx !== null && (
                    <div style={{ padding: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 500, fontSize: 14 }}>onomatopeya</span>
                        <div style={{ flex: 1 }} />
                        <button className="btn btn-ghost btn-sm btn-danger" onClick={() => removeSfxFromPanel(selectedPanelIdx, selectedSfxIdx)}>×</button>
                      </div>
                      <div style={{ marginTop: 12 }}>
                        <label className="label">texto</label>
                        <input
                          className="input"
                          value={selectedSfxData.text}
                          onChange={e => updateSfxInPanel(selectedPanelIdx, selectedSfxIdx, { text: e.target.value })}
                          placeholder="BAM, WHOOSH..."
                        />
                      </div>
                      <div style={{ marginTop: 12 }}>
                        <label className="label">estilo</label>
                        <div className="radio-group">
                          {SFX_STYLES.map(s => (
                            <div
                              key={s.id}
                              className={`radio-pill ${selectedSfxData.style === s.id ? 'active' : ''}`}
                              onClick={() => updateSfxInPanel(selectedPanelIdx, selectedSfxIdx, { style: s.id })}
                            >
                              {s.label}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}

              {/* General sidebar content — always rendered underneath */}
              <div className="editor-sidebar" style={{ height: '100%', overflow: 'auto' }}>
              {/* Composition guides */}
              <div className="editor-guide-tools">
                <label className="label">guías</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button className={`btn btn-sm ${panel?.horizon ? '' : 'btn-ghost'}`} onClick={toggleHorizon}>Horizonte</button>
                  <button className={`btn btn-sm ${gridVisible ? '' : 'btn-ghost'}`} onClick={() => setGridVisible(value => !value)}>Grilla</button>
                  {panel?.horizon && <button className="btn btn-ghost btn-sm btn-danger" onClick={() => updatePanel(selectedPanelIdx, { horizon: null })}>×</button>}
                </div>
                {panel?.horizon && <input className="input" value={panel.horizon.description || ''} onChange={e => updatePanel(selectedPanelIdx, { horizon: { ...panel.horizon, description: e.target.value } })} placeholder="descripción del horizonte..." style={{ fontSize: 12 }} />}
              </div>

              {/* Scene */}
              <div>
                <label className="label">escena</label>
                <input
                  className="input"
                  value={panel?.scene || ''}
                  onChange={e => updatePanel(selectedPanelIdx, { scene: e.target.value })}
                  placeholder="describe la escena..."
                />
              </div>

              {/* Shot type + Hatch */}
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label className="label">plano</label>
                  <div className="radio-group">
                    {SHOT_TYPES.map(st => (
                      <div
                        key={st.id}
                        className={`radio-pill ${panel?.shotType === st.id ? 'active' : ''}`}
                        onClick={() => updatePanel(selectedPanelIdx, { shotType: panel?.shotType === st.id ? null : st.id })}
                        title={st.desc}
                      >
                        {st.label}
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <label className="label">trama</label>
                  <div className="radio-group">
                    {HATCH_TYPES.map(h => (
                      <div
                        key={h.id}
                        className={`radio-pill ${panel?.hatch === h.id ? 'active' : ''}`}
                        onClick={() => updatePanel(selectedPanelIdx, { hatch: panel?.hatch === h.id ? null : h.id })}
                        title={h.desc}
                      >
                        {h.label}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Elements: Characters + Background + Objects as dropdowns */}
              <div>
                <label className="label">elementos</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {/* Characters */}
                  <select
                    className="input"
                    value=""
                    onChange={e => { if (e.target.value) { addCharacterToPanel(selectedPanelIdx, e.target.value); e.target.value = '' } }}
                    style={{ fontSize: 12, cursor: 'pointer' }}
                  >
                    <option value="">+ personaje...</option>
                    {characters.map(char => (
                      <option key={char.id} value={char.id}>{char.name}</option>
                    ))}
                  </select>
                  {panel?.characters?.length > 0 && (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {panel.characters.map((item, idx) => {
                        const char = characters.find(c => c.id === item.characterId)
                        return char ? (
                          <span
                            key={idx}
                            className="radio-pill"
                            style={{ fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, borderColor: char.color, color: char.color }}
                            onClick={() => { setSelectedCharIdx(idx); setSelectedObjIdx(null); setSelectedSfxIdx(null); setSelectedNarr(false); setSelectedBalloon(null) }}
                          >
                            <span className="color-dot" style={{ background: char.color || '#999' }} />
                            {char.name}
                            <span style={{ cursor: 'pointer', fontWeight: 700, fontSize: 10 }} onClick={e => { e.stopPropagation(); removeCharacterFromPanel(selectedPanelIdx, idx) }}>x</span>
                          </span>
                        ) : null
                      })}
                    </div>
                  )}

                  {/* Background */}
                  <select
                    className="input"
                    value={panel?.backgroundId || ''}
                    onChange={e => setBackgroundForPanel(selectedPanelIdx, e.target.value || null)}
                    style={{ fontSize: 12, cursor: 'pointer' }}
                  >
                    <option value="">fondo...</option>
                    {backgrounds.map(bg => (
                      <option key={bg.id} value={bg.id}>{bg.name}</option>
                    ))}
                  </select>
                  {(() => {
                    const bgDef = panel?.backgroundId ? backgrounds.find(b => b.id === panel.backgroundId) : null
                    if (!bgDef?.comodin) return null
                    return (
                      <AutoTextarea
                        value={panel?.comodinDesc || ''}
                        onChange={e => updatePanel(selectedPanelIdx, { comodinDesc: e.target.value })}
                        placeholder="qué es este fondo: ej. 'un baldío detrás de un supermercado'..."
                        minRows={3}
                      />
                    )
                  })()}

                  {/* Objects */}
                  <select
                    className="input"
                    value=""
                    onChange={e => { if (e.target.value) { toggleObjectInPanel(selectedPanelIdx, e.target.value); e.target.value = '' } }}
                    style={{ fontSize: 12, cursor: 'pointer' }}
                  >
                    <option value="">+ objeto...</option>
                    {objects.map(obj => (
                      <option key={obj.id} value={obj.id}>{obj.name}</option>
                    ))}
                  </select>
                  {panel?.objects?.length > 0 && (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {panel.objects.map((item, idx) => {
                        const obj = objects.find(o => o.id === item.objectId)
                        return obj ? (
                          <span
                            key={idx}
                            className="radio-pill"
                            style={{ fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, borderColor: obj.color, color: obj.color }}
                            onClick={() => setSelectedObjIdx(idx)}
                          >
                            <span className="color-dot" style={{ background: obj.color || '#999' }} />
                            {obj.name}
                            <span style={{ cursor: 'pointer', fontWeight: 700, fontSize: 10 }} onClick={e => { e.stopPropagation(); removeObjectFromPanel(selectedPanelIdx, idx) }}>x</span>
                          </span>
                        ) : null
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* SFX */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <label className="label" style={{ marginBottom: 0 }}>onomatopeyas</label>
                  <button className="btn btn-ghost btn-sm" onClick={() => addSfxToPanel(selectedPanelIdx)} style={{ fontSize: 11 }}>+ agregar</button>
                </div>
                {(panel?.sfx || []).length > 0 ? (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {(panel.sfx || []).map((s, i) => (
                      <span
                        key={i}
                        className={`radio-pill ${selectedSfxIdx === i ? 'active' : ''}`}
                        style={{ fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                        onClick={() => setSelectedSfxIdx(selectedSfxIdx === i ? null : i)}
                      >
                        {s.text || '(vacío)'}
                        <span style={{ cursor: 'pointer', fontWeight: 700, fontSize: 10 }} onClick={(e) => { e.stopPropagation(); removeSfxFromPanel(selectedPanelIdx, i) }}>×</span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>sin onomatopeyas</div>
                )}
              </div>

              {/* Narration */}
              <div>
                <label className="label">narración</label>
                <label className="check-item" style={{ marginBottom: 6 }}>
                  <div
                    className={`check-box ${panel?.narration ? 'checked' : ''}`}
                    onClick={() => panel?.narration ? removeNarrationFromPanel(selectedPanelIdx) : addNarrationToPanel(selectedPanelIdx)}
                  />
                  <span style={{ fontSize: 12 }}>poner</span>
                </label>
                {panel?.narration && (
                  <AutoTextarea
                    value={panel.narration.text || ''}
                    onChange={e => updateNarrationInPanel(selectedPanelIdx, { text: e.target.value })}
                    placeholder="texto del narrador..."
                    minRows={2}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
