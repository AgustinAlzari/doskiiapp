import { useState, useCallback, useRef, useEffect } from 'react'
import useStripStore from '../../store/stripStore'
import useCharacterStore from '../../store/characterStore'
import useBackgroundStore from '../../store/backgroundStore'
import useObjectStore from '../../store/objectStore'
import useBalloonStore from '../../store/balloonStore'
import usePaletteStore, { resolvePaletteColors } from '../../store/paletteStore'
import useAuthorStore from '../../store/authorStore'
import { SHOT_TYPES, HATCH_TYPES, SFX_STYLES, ASPECT_RATIOS, aspectLabel } from '../../data/actionPresets'
import { orderedPanelDialogues } from '../../services/promptGenerator'
import PanelCanvas from './PanelCanvas'
import CharacterPropsPanel from './CharacterPropsPanel'
import BalloonPropsPanel from './BalloonPropsPanel'
import SpellCheckedTextarea from '../SpellCheckedTextarea'
import SpellCheckedInput from '../SpellCheckedInput'
import useChatStore from '../../store/chatStore'
import EntityMenu from './EntityMenu'

export default function StripEditor({ strip, project, onBack, onEditCharacter, onShowPrompts }) {
  const chatOpen = useChatStore(s => s.open)
  const save = useStripStore(s => s.save)
  const characters = useCharacterStore(s => s.characters)
  const backgrounds = useBackgroundStore(s => s.backgrounds)
  const objects = useObjectStore(s => s.objects)
  const balloons = useBalloonStore(s => s.balloons)
  const palettes = usePaletteStore(s => s.palettes)
  const authors = useAuthorStore(s => s.authors)
  const [data, setDataState] = useState(strip)
  const [selectedCharIdx, setSelectedCharIdx] = useState(null)
  const [selectedObjIdx, setSelectedObjIdx] = useState(null)
  const [selectedSfxIdx, setSelectedSfxIdx] = useState(null)
  const [selectedNarr, setSelectedNarr] = useState(false)
  const [selectedBalloon, setSelectedBalloon] = useState(null)
  const [selectedGloboXIdx, setSelectedGloboXIdx] = useState(null)
  const [selectedSignature, setSelectedSignature] = useState(false)
  const [selectedBackground, setSelectedBackground] = useState(false)
  const [saveState, setSaveState] = useState(null)
  const [gridVisible, setGridVisible] = useState(true)
  const canvasRef = useRef(null)

  const projectBalloons = balloons.filter(b => b.projectId === project?.id)
  const wildcardBalloon = projectBalloons.find(b => b.comodin) || null

  // Solo los elementos del proyecto activo (los desplegables no deben mezclar proyectos).
  const projectCharacters = characters.filter(c => c.projectId === project?.id)
  const projectBackgrounds = backgrounds.filter(b => b.projectId === project?.id)
  const projectObjects = objects.filter(o => o.projectId === project?.id)

  const dataRef = useRef(strip)
  const historyRef = useRef([])
  const lastEditRef = useRef({ time: 0 })
  const [undoSteps, setUndoSteps] = useState(0)

  const setData = useCallback((updaterOrValue) => {
    const now = Date.now()
    const prev = dataRef.current
    if (now - lastEditRef.current.time > 400) {
      historyRef.current = [...historyRef.current, prev].slice(-5)
      setUndoSteps(historyRef.current.length)
    }
    lastEditRef.current.time = now
    setDataState(p => {
      const next = typeof updaterOrValue === 'function' ? updaterOrValue(p) : updaterOrValue
      dataRef.current = next
      return next
    })
  }, [])

  const deselectAll = useCallback(() => {
    setSelectedCharIdx(null)
    setSelectedObjIdx(null)
    setSelectedSfxIdx(null)
    setSelectedNarr(false)
    setSelectedBalloon(null)
    setSelectedGloboXIdx(null)
    setSelectedSignature(false)
    setSelectedBackground(false)
  }, [])

  const selectBackground = useCallback(() => {
    setSelectedBackground(true)
    setSelectedCharIdx(null)
    setSelectedObjIdx(null)
    setSelectedSfxIdx(null)
    setSelectedNarr(false)
    setSelectedBalloon(null)
    setSelectedGloboXIdx(null)
    setSelectedSignature(false)
  }, [])

  const undo = useCallback(() => {
    const h = historyRef.current
    if (!h.length) return
    const prev = h[h.length - 1]
    historyRef.current = h.slice(0, -1)
    lastEditRef.current.time = 0
    setUndoSteps(historyRef.current.length)
    dataRef.current = prev
    setDataState(prev)
    deselectAll()
  }, [deselectAll])

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        const t = e.target
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
        e.preventDefault()
        undo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo])

  const panel = data.panels[0]

  const updatePanel = useCallback((panelIdx, updates) => {
    setData(prev => {
      const panels = [...prev.panels]
      panels[panelIdx] = { ...panels[panelIdx], ...updates }
      return { ...prev, panels }
    })
  }, [])

  const toggleHorizon = useCallback(() => {
    updatePanel(0, { horizon: panel?.horizon ? null : { y: 0.5, description: '' } })
  }, [panel?.horizon, updatePanel])

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
      const zCounter = panels[panelIdx].zCounter || 0
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
        balloonId: wildcardBalloon?.id || null,
        dialoguePosition: null,
        extraDialogues: [],
        actions: [],
        actionNotes: '',
        gazeTarget: null,
        z: zCounter,
      })
      panels[panelIdx] = { ...panels[panelIdx], characters, zCounter: zCounter + 1 }
      return { ...prev, panels }
    })
  }, [wildcardBalloon])

  const removeCharacterFromPanel = useCallback((panelIdx, charIdx) => {
    setData(prev => {
      const panels = [...prev.panels]
      const removedId = panels[panelIdx].characters[charIdx]?.characterId
      const characters = panels[panelIdx].characters.filter((_, i) => i !== charIdx)
        .map(c => c.gazeTarget?.type === 'character' && c.gazeTarget?.id === removedId ? { ...c, gazeTarget: null } : c)
      const connections = (panels[panelIdx].connections || []).filter(c =>
        c.from !== removedId && !(c.to === removedId && (c.toType || 'character') === 'character')
      )
      panels[panelIdx] = { ...panels[panelIdx], characters, connections }
      return { ...prev, panels }
    })
    setSelectedCharIdx(null)
  }, [])

  const setBackgroundForPanel = useCallback((panelIdx, backgroundId) => {
    setData(prev => {
      const panels = [...prev.panels]
      const connections = backgroundId
        ? panels[panelIdx].connections
        : (panels[panelIdx].connections || []).filter(c => (c.toType || 'character') !== 'background')
      panels[panelIdx] = {
        ...panels[panelIdx],
        backgroundId,
        background: backgroundId ? (panels[panelIdx].background || { x: 0.05, y: 0.1, width: 0.9, height: 0.45 }) : null,
        connections,
      }
      return { ...prev, panels }
    })
  }, [])

  const updateBackground = useCallback((panelIdx, updates) => {
    setData(prev => {
      const panels = [...prev.panels]
      // El fondo se estira libre (sin forzar proporción) hasta cubrir el cuadro completo.
      const nextBackground = { ...panels[panelIdx].background, ...updates }
      panels[panelIdx] = { ...panels[panelIdx], background: nextBackground }
      return { ...prev, panels }
    })
  }, [])

  const toggleObjectInPanel = useCallback((panelIdx, objectId) => {
    setData(prev => {
      const panels = [...prev.panels]
      const currentObjects = panels[panelIdx].objects || []
      const zCounter = panels[panelIdx].zCounter || 0
      const nextObjects = [...currentObjects, {
        objectId,
        x: 0.35 + (currentObjects.length % 3) * 0.08,
        y: 0.3 + (currentObjects.length % 2) * 0.08,
        width: 0.15,
        height: 0.15,
        z: zCounter,
      }]
      panels[panelIdx] = { ...panels[panelIdx], objects: nextObjects, zCounter: zCounter + 1 }
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
      const removedId = (panels[panelIdx].objects || [])[objIdx]?.objectId
      const connections = (panels[panelIdx].connections || []).filter(c => !(c.to === removedId && (c.toType || 'character') === 'object'))
      const characters = (panels[panelIdx].characters || []).map(c =>
        c.gazeTarget?.type === 'object' && c.gazeTarget?.id === removedId ? { ...c, gazeTarget: null } : c
      )
      panels[panelIdx] = { ...panels[panelIdx], objects, connections, characters }
      return { ...prev, panels }
    })
  }, [])

  // SFX
  const addSfxToPanel = useCallback((panelIdx) => {
    setData(prev => {
      const panels = [...prev.panels]
      const sfx = [...(panels[panelIdx].sfx || [])]
      const zCounter = panels[panelIdx].zCounter || 0
      sfx.push({
        text: '',
        x: 0.6,
        y: 0.1,
        width: 0.15,
        height: 0.1,
        style: 'default',
        z: zCounter,
      })
      panels[panelIdx] = { ...panels[panelIdx], sfx, zCounter: zCounter + 1 }
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
      const zCounter = panels[panelIdx].zCounter || 0
      panels[panelIdx] = {
        ...panels[panelIdx],
        narration: { text: '', x: 0.05, y: 0.02, width: 0.4, height: 0.12, framed: true, z: zCounter },
        zCounter: zCounter + 1,
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

  // Signature (firma)
  const updateSignatureInPanel = useCallback((panelIdx, updates) => {
    setData(prev => {
      const panels = [...prev.panels]
      const signature = { ...(panels[panelIdx].signature || {}), ...updates }
      panels[panelIdx] = { ...panels[panelIdx], signature }
      return { ...prev, panels }
    })
  }, [setData])

  const removeSignatureFromPanel = useCallback((panelIdx) => {
    updatePanel(panelIdx, { signature: null })
    setSelectedSignature(false)
  }, [updatePanel])

  const toggleSignature = useCallback(() => {
    if (panel?.signature) {
      removeSignatureFromPanel(0)
    } else {
      const zCounter = panel?.zCounter || 0
      updatePanel(0, { signature: { x: 0.7, y: 0.85, width: 0.25, height: 0.1, colorId: null, z: zCounter }, zCounter: zCounter + 1 })
      setSelectedSignature(true)
    }
  }, [panel?.signature, panel?.zCounter, updatePanel, removeSignatureFromPanel])

  const selectSignature = useCallback(() => {
    setSelectedSignature(true)
    setSelectedCharIdx(null)
    setSelectedObjIdx(null)
    setSelectedSfxIdx(null)
    setSelectedNarr(false)
    setSelectedBalloon(null)
    setSelectedGloboXIdx(null)
    setSelectedBackground(false)
  }, [])

  //XX

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
    updateDialoguePos(0, balloon.characterId, balloon.isExtra, balloon.extraIdx, { x, y })
  }, [updateDialoguePos])

  const resizeBalloon = useCallback((balloon, updates) => {
    updateDialoguePos(0, balloon.characterId, balloon.isExtra, balloon.extraIdx, updates)
  }, [updateDialoguePos])

  const selectBalloon = useCallback((balloon) => {
    setSelectedCharIdx(null)
    setSelectedObjIdx(null)
    setSelectedSfxIdx(null)
    setSelectedNarr(false)
    setSelectedGloboXIdx(null)
    setSelectedBackground(false)
    setSelectedBalloon({ characterId: balloon.characterId, isExtra: balloon.isExtra, extraIdx: balloon.extraIdx })
  }, [])

  const selectGloboX = useCallback((idx) => {
    setSelectedGloboXIdx(idx)
    setSelectedCharIdx(null)
    setSelectedObjIdx(null)
    setSelectedSfxIdx(null)
    setSelectedNarr(false)
    setSelectedBalloon(null)
    setSelectedBackground(false)
  }, [])

  const applyDialogueBalloonUpdate = useCallback((updates) => {
    if (!selectedBalloon) return
    const charIdx = (data.panels[0]?.characters || []).findIndex(c => c.characterId === selectedBalloon.characterId)
    if (charIdx < 0) return
    if (selectedBalloon.isExtra) {
      const char = data.panels[0].characters[charIdx]
      const extras = [...(char.extraDialogues || [])]
      extras[selectedBalloon.extraIdx] = { ...(extras[selectedBalloon.extraIdx] || {}), ...updates }
      updateCharacterInPanel(0, charIdx, { extraDialogues: extras })
    } else {
      updateCharacterInPanel(0, charIdx, updates)
    }
  }, [selectedBalloon, data.panels, updateCharacterInPanel])

  // Globo X (free balloons)
  const addGloboXToPanel = useCallback((panelIdx, balloonId) => {
    const idx = (data.panels[panelIdx]?.globosX || []).length
    const ent = balloons.find(b => b.id === balloonId)
    setData(prev => {
      const panels = [...prev.panels]
      const globosX = [...(panels[panelIdx].globosX || [])]
      const zCounter = panels[panelIdx].zCounter || 0
      globosX.push({
        id: crypto.randomUUID(),
        text: '',
        channel: ent?.kind === 'thought' ? 'thought' : 'speech',
        balloonId,
        x: 0.4,
        y: 0.05,
        width: 0.3,
        height: 0.1,
        anchor: { type: 'none' },
        z: zCounter,
      })
      panels[panelIdx] = { ...panels[panelIdx], globosX, zCounter: zCounter + 1 }
      return { ...prev, panels }
    })
    setSelectedGloboXIdx(idx)
    setSelectedCharIdx(null)
    setSelectedObjIdx(null)
    setSelectedSfxIdx(null)
    setSelectedNarr(false)
    setSelectedBalloon(null)
  }, [data.panels, balloons])

  const updateGloboXInPanel = useCallback((panelIdx, gIdx, updates) => {
    setData(prev => {
      const panels = [...prev.panels]
      if (!panels[panelIdx]?.globosX?.[gIdx]) return prev
      const globosX = [...panels[panelIdx].globosX]
      globosX[gIdx] = { ...globosX[gIdx], ...updates }
      panels[panelIdx] = { ...panels[panelIdx], globosX }
      return { ...prev, panels }
    })
  }, [])

  const removeGloboXFromPanel = useCallback((panelIdx, gIdx) => {
    setData(prev => {
      const panels = [...prev.panels]
      const globosX = (panels[panelIdx]?.globosX || []).filter((_, i) => i !== gIdx)
      panels[panelIdx] = { ...panels[panelIdx], globosX }
      return { ...prev, panels }
    })
    setSelectedGloboXIdx(null)
  }, [])

  const moveGloboX = useCallback((idx, { x, y }) => updateGloboXInPanel(0, idx, { x, y }), [updateGloboXInPanel])
  const resizeGloboX = useCallback((idx, updates) => updateGloboXInPanel(0, idx, updates), [updateGloboXInPanel])

  const removeDialogueBalloon = useCallback((balloon) => {
    setData(prev => {
      const panels = [...prev.panels]
      const characters = [...(panels[0].characters || [])]
      const charIdx = characters.findIndex(c => c.characterId === balloon.characterId)
      if (charIdx < 0) return prev
      const char = characters[charIdx]
      if (balloon.isExtra) {
        characters[charIdx] = { ...char, extraDialogues: (char.extraDialogues || []).filter((_, i) => i !== balloon.extraIdx) }
      } else {
        characters[charIdx] = { ...char, dialogue: '', dialoguePos: null }
      }
      panels[0] = { ...panels[0], characters }
      return { ...prev, panels }
    })
    setSelectedBalloon(null)
    setSelectedCharIdx(null)
  }, [])

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

  // Autoguarda el título al salir del campo (o Enter): se persiste desde el editor.
  const autosaveTitle = () => {
    if (data.title !== (strip?.title)) save(data)
  }

  const selectedCharData = selectedCharIdx != null ? panel?.characters[selectedCharIdx] : null
  const selectedCharDef = selectedCharData ? characters.find(c => c.id === selectedCharData.characterId) : null
  const selectedSfxData = panel?.sfx?.[selectedSfxIdx]
  const selectedObjData = panel?.objects?.[selectedObjIdx]
  const selectedObjDef = selectedObjData && objects.find(item => item.id === selectedObjData.objectId)

  const orderedForPanel = (() => { try { return orderedPanelDialogues(panel || { characters: [] }, characters) } catch { return [] } })()

  const selectedGloboXData = selectedGloboXIdx != null ? panel?.globosX?.[selectedGloboXIdx] : null

  const selectedDialogueBalloon = (() => {
    if (!selectedBalloon) return null
    const char = (panel?.characters || []).find(c => c.characterId === selectedBalloon.characterId)
    if (!char) return null
    const def = characters.find(c => c.id === char.characterId)
    if (selectedBalloon.isExtra) {
      const extra = (char.extraDialogues || [])[selectedBalloon.extraIdx]
      if (!extra) return null
      const found = orderedForPanel.find(d => d.characterId === char.characterId && d.isExtra && d.extraIdx === selectedBalloon.extraIdx)
      return { label: found?.label || `G${found?.number || ''}`, characterName: def?.name || '', text: extra.text || '', channel: extra.type || 'speech', balloonId: extra.balloonId || null }
    }
    const found = orderedForPanel.find(d => d.characterId === char.characterId && !d.isExtra)
    return { label: found?.label || `G${found?.number || ''}`, characterName: def?.name || '', text: char.dialogue || '', channel: char.dialogueType || 'speech', balloonId: char.balloonId || null }
  })()

  const selectedGloboXLabel = selectedGloboXIdx != null
    ? `X${((panel?.globosX || []).slice(0, selectedGloboXIdx + 1).filter(x => x.text).length) || selectedGloboXIdx + 1}`
    : 'X'

  const author = project?.authorId ? (authors.find(a => a.id === project.authorId) || null) : null
  const paletteColors = resolvePaletteColors(project, palettes)
  const signatureColor = (() => {
    const c = paletteColors.find(c => c.id === panel?.signature?.colorId)
    return c?.hex || null
  })()
  const signatureText = author?.signatureText || author?.fullName || ''
  const signatureImageRef = author?.signatureImage?.[0] || null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', marginRight: chatOpen ? 520 : 0 }}>
      {/* Header */}
      <div className="section-header">
        <button className="back-arrow" onClick={onBack}>←</button>
        <input
          className="ui-h2"
          value={data.title}
          onChange={e => setData(prev => ({ ...prev, title: e.target.value }))}
          onBlur={autosaveTitle}
          onKeyDown={e => { if (e.key === 'Enter') { e.target.blur(); autosaveTitle() } }}
          placeholder="título..."
          style={{ flex: 1, fontSize: 16, border: 'none', background: 'transparent', padding: 0, outline: 'none' }}
        />
        <span
          onClick={undo}
          title="deshacer · Ctrl+Z"
          style={{
            fontSize: 12,
            color: undoSteps === 0 ? 'var(--color-text-muted)' : 'var(--color-accent)',
            cursor: undoSteps === 0 ? 'default' : 'pointer',
            userSelect: 'none',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          ctrl-z
        </span>
        <select
          className="time-pill"
          value={data.aspectRatio || 'hd'}
          onChange={e => setData(prev => ({ ...prev, aspectRatio: e.target.value }))}
          title="proporción del cuadro"
          style={{ flexShrink: 0, cursor: 'pointer' }}
        >
          {ASPECT_RATIOS.map(ar => <option key={ar.id} value={ar.id}>{aspectLabel(ar)}</option>)}
        </select>
        <button className="btn btn-sm" onClick={() => onShowPrompts(data, characters, balloons)}>
          prompts
        </button>
        <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saveState === 'saving'}>
          {saveState === 'saving' ? 'guardando...' : saveState === 'saved' ? 'guardado ✓' : 'guardar'}
        </button>
      </div>

      {/* Editor content */}
      <div style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0 }}>
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
                selectedGloboXIdx={selectedGloboXIdx}
                onSelectChar={(idx) => { setSelectedCharIdx(idx); setSelectedObjIdx(null); setSelectedSfxIdx(null); setSelectedBalloon(null); setSelectedGloboXIdx(null); setSelectedBackground(false) }}
                onSelectObj={(idx) => { setSelectedObjIdx(idx); setSelectedCharIdx(null); setSelectedSfxIdx(null); setSelectedBalloon(null); setSelectedGloboXIdx(null); setSelectedBackground(false) }}
                onSelectSfx={(idx) => { setSelectedSfxIdx(idx); setSelectedCharIdx(null); setSelectedObjIdx(null); setSelectedBalloon(null); setSelectedGloboXIdx(null); setSelectedBackground(false) }}
                selectedNarr={selectedNarr}
                onSelectNarr={() => { setSelectedNarr(true); setSelectedCharIdx(null); setSelectedObjIdx(null); setSelectedSfxIdx(null); setSelectedBalloon(null); setSelectedGloboXIdx(null); setSelectedBackground(false) }}
                selectedBackground={selectedBackground}
                onSelectBackground={selectBackground}
                onSelectBalloon={selectBalloon}
                onSelectGloboX={selectGloboX}
                onMoveBalloon={moveBalloon}
                onResizeBalloon={resizeBalloon}
                onRemoveBalloon={removeDialogueBalloon}
                onMoveGloboX={moveGloboX}
                onResizeGloboX={resizeGloboX}
                onRemoveGloboX={(idx) => removeGloboXFromPanel(0, idx)}
                onUpdateChar={(charIdx, updates) => updateCharacterInPanel(0, charIdx, updates)}
                onUpdateObj={(objIdx, updates) => updateObjectInPanel(0, objIdx, updates)}
                onUpdateSfx={(sfxIdx, updates) => updateSfxInPanel(0, sfxIdx, updates)}
                onRemoveChar={(charIdx) => removeCharacterFromPanel(0, charIdx)}
                onRemoveObj={(objIdx) => removeObjectFromPanel(0, objIdx)}
                onRemoveSfx={(sfxIdx) => removeSfxFromPanel(0, sfxIdx)}
                onUpdateNarr={(updates) => updateNarrationInPanel(0, updates)}
                onRemoveNarr={() => removeNarrationFromPanel(0)}
                onRemoveBackground={() => setBackgroundForPanel(0, null)}
                onUpdateBackground={(updates) => updateBackground(0, updates)}
                onUpdateHorizon={(updates) => updatePanel(0, { horizon: updates })}
                connections={panel?.connections || []}
                onAddConnection={(fromId, toId, toType) => addConnection(0, fromId, toId, toType)}
                onRemoveConnection={(fromId, toId) => removeConnection(0, fromId, toId)}
                onCanvasClick={deselectAll}
                signature={panel?.signature || null}
                selectedSignature={selectedSignature}
                onSelectSignature={selectSignature}
                onUpdateSignature={(updates) => updateSignatureInPanel(0, updates)}
                onRemoveSignature={() => removeSignatureFromPanel(0)}
                signatureColor={signatureColor}
                signatureText={signatureText}
                signatureImagePath={signatureImageRef?.path || null}
              />
            </div>

            {/* General sidebar — always fixed width, right side, relative container */}
            <div
              style={{ width: 360, flexShrink: 0, alignSelf: 'stretch', position: 'relative', overflow: 'hidden' }}
            >
              {/* Properties overlay — absolute, covers sidebar when active */}
              {(selectedDialogueBalloon) || (selectedGloboXData) || (selectedCharData && selectedCharDef) || (selectedObjData && selectedObjDef) || (selectedSfxData && selectedSfxIdx !== null) || selectedBackground ? (
                <div className="editor-sidebar" style={{ position: 'absolute', inset: 0, overflow: 'auto', zIndex: 5, background: 'var(--color-bg)' }}>
                  {selectedDialogueBalloon && (
                    <BalloonPropsPanel
                      kind="dialogue"
                      label={selectedDialogueBalloon.label}
                      characterName={selectedDialogueBalloon.characterName}
                      text={selectedDialogueBalloon.text}
                      balloonId={selectedDialogueBalloon.balloonId}
                      balloons={projectBalloons}
                      defaultBalloon={wildcardBalloon}
                      onText={(text) => applyDialogueBalloonUpdate(selectedBalloon.isExtra ? { text } : { dialogue: text })}
                      onType={(id, kind) => applyDialogueBalloonUpdate(selectedBalloon.isExtra
                        ? { balloonId: id, type: kind === 'thought' ? 'thought' : 'speech' }
                        : { balloonId: id, dialogueType: kind === 'thought' ? 'thought' : 'speech' })}
                      onRemove={() => removeDialogueBalloon(selectedBalloon)}
                      onClose={() => setSelectedBalloon(null)}
                    />
                  )}
                  {selectedGloboXData && (
                    <BalloonPropsPanel
                      kind="globox"
                      label={selectedGloboXLabel}
                      text={selectedGloboXData.text || ''}
                      balloonId={selectedGloboXData.balloonId || null}
                      balloons={projectBalloons}
                      defaultBalloon={wildcardBalloon}
                      anchor={selectedGloboXData.anchor || { type: 'none' }}
                      panelCharacters={panel?.characters || []}
                      panelObjects={panel?.objects || []}
                      characters={characters}
                      objects={objects}
                      onText={(text) => updateGloboXInPanel(0, selectedGloboXIdx, { text })}
                      onType={(id, kind) => updateGloboXInPanel(0, selectedGloboXIdx, { balloonId: id, channel: kind === 'thought' ? 'thought' : 'speech' })}
                      onAnchor={(anchor) => updateGloboXInPanel(0, selectedGloboXIdx, { anchor })}
                      onRemove={() => removeGloboXFromPanel(0, selectedGloboXIdx)}
                      onClose={() => setSelectedGloboXIdx(null)}
                    />
                  )}
                  {selectedCharData && selectedCharDef && (
                    <CharacterPropsPanel
                      key={`char-${selectedCharIdx}`}
                      character={selectedCharDef}
                      panelChar={selectedCharData}
                      panelCharacters={panel?.characters || []}
                      panelObjects={panel?.objects || []}
                      panelNarration={panel?.narration}
                      panelConnections={panel?.connections || []}
                      allCharacters={characters}
                      allObjects={objects}
                      defaultBalloonId={wildcardBalloon?.id || null}
                      onUpdate={(updates) => updateCharacterInPanel(0, selectedCharIdx, updates)}
                      onRemove={() => removeCharacterFromPanel(0, selectedCharIdx)}
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
                            <SpellCheckedTextarea
                              value={selectedObjData.comodinDesc || ''}
                              onChange={e => updateObjectInPanel(0, selectedObjIdx, { comodinDesc: e.target.value })}
                              placeholder="ej. 'un microondas abandonado lleno de moscas'..."
                              minRows={3}
                            />
                          </div>
                        )}
                        <label className="label">sobre el objeto</label>
                        <SpellCheckedTextarea
                          value={selectedObjData.note || ''}
                          onChange={e => updateObjectInPanel(0, selectedObjIdx, { note: e.target.value })}
                          placeholder="qué ocurre sobre este objeto, qué contiene o qué relación tiene con la escena..."
                          minRows={4}
                        />
                      </div>
                    </div>
                  )}
                  {selectedBackground && (() => {
                    const bgDef = panel?.backgroundId ? backgrounds.find(b => b.id === panel.backgroundId) : null
                    return (
                      <div style={{ padding: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className="color-dot" style={{ background: bgDef?.color || 'var(--color-border)' }} />
                          <span style={{ fontWeight: 500, fontSize: 14 }}>{bgDef?.name || 'fondo'}</span>
                          <div style={{ flex: 1 }} />
                          <button className="btn btn-ghost btn-sm btn-danger" onClick={() => setSelectedBackground(false)}>×</button>
                        </div>
                        <div style={{ marginTop: 12 }}>
                          <label className="label">fondo</label>
                          <EntityMenu
                            options={projectBackgrounds}
                            value={panel?.backgroundId || ''}
                            placeholder="fondo..."
                            onSelect={(id) => setBackgroundForPanel(0, id || null)}
                            allowClear={!!panel?.backgroundId}
                            style={{ fontSize: 12 }}
                          />
                        </div>
                        {bgDef?.comodin && (
                          <div style={{ marginTop: 12 }}>
                            <label className="label">qué es este fondo</label>
                            <SpellCheckedTextarea
                              value={panel?.comodinDesc || ''}
                              onChange={e => updatePanel(0, { comodinDesc: e.target.value })}
                              placeholder="qué es este fondo: ej. 'un baldío detrás de un supermercado'..."
                              minRows={3}
                            />
                          </div>
                        )}
                        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 12 }}>
                          arrastrá para mover el fondo; usá las esquinas para redimensionarlo.
                        </div>
                      </div>
                    )
                  })()}
                  {selectedSfxData && selectedSfxIdx !== null && (
                    <div style={{ padding: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 500, fontSize: 14 }}>onomatopeya</span>
                        <div style={{ flex: 1 }} />
                        <button className="btn btn-ghost btn-sm btn-danger" onClick={() => removeSfxFromPanel(0, selectedSfxIdx)}>×</button>
                      </div>
                      <div style={{ marginTop: 12 }}>
                        <label className="label">texto</label>
                        <SpellCheckedInput
                          value={selectedSfxData.text}
                          onChange={e => updateSfxInPanel(0, selectedSfxIdx, { text: e.target.value })}
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
                              onClick={() => updateSfxInPanel(0, selectedSfxIdx, { style: s.id })}
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
                  <button className={`btn btn-sm ${panel?.horizon ? '' : 'btn-ghost'}`} onClick={toggleHorizon}>horizonte</button>
                  <button className={`btn btn-sm ${gridVisible ? '' : 'btn-ghost'}`} onClick={() => setGridVisible(value => !value)}>grilla</button>
                  {panel?.horizon && <button className="btn btn-ghost btn-sm btn-danger" onClick={() => updatePanel(0, { horizon: null })}>×</button>}
                </div>
                {panel?.horizon && <input className="input" value={panel.horizon.description || ''} onChange={e => updatePanel(0, { horizon: { ...panel.horizon, description: e.target.value } })} placeholder="descripción del horizonte..." style={{ fontSize: 12 }} />}
              </div>

              {/* Firma */}
              <div>
                <label className="label">firma</label>
                <label className="check-item" style={{ marginBottom: 6 }}>
                  <div
                    className={`check-box ${panel?.signature ? 'checked' : ''}`}
                    onClick={toggleSignature}
                  />
                  <span style={{ fontSize: 12 }}>poner</span>
                </label>
                {panel?.signature && (
                  <>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 8 }}>
                      {author
                        ? (signatureImageRef
                          ? `firma en imagen: ${signatureImageRef.fileName}`
                          : signatureText
                            ? `firma: «${signatureText}»`
                            : `firma de ${author.fullName}`)
                        : 'el proyecto no tiene autor asignado: la firma se dibuja igual (sin imagen).'}
                    </div>
                    <label className="label">color</label>
                    <div className="radio-group" style={{ flexWrap: 'wrap' }}>
                      <div
                        className={`radio-pill ${!panel.signature.colorId ? 'active' : ''}`}
                        onClick={() => updateSignatureInPanel(0, { colorId: null })}
                        title="tinta por defecto (negro en B&N)"
                      >
                        vacío (tinta)
                      </div>
                      {paletteColors.filter(c => c.hex).map(c => (
                        <div
                          key={c.id}
                          className={`radio-pill ${panel.signature.colorId === c.id ? 'active' : ''}`}
                          style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                          onClick={() => updateSignatureInPanel(0, { colorId: c.id })}
                          title={c.label || c.hex}
                        >
                          <span className="color-dot" style={{ background: c.hex }} />
                          {c.label || c.hex}
                        </div>
                      ))}
                    </div>
                    {paletteColors.length === 0 && (
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                        el proyecto está en B&N o sin colores de paleta: se usa la tinta por defecto.
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Scene */}
              <div>
                <label className="label">escena</label>
                <textarea
                  className="input"
                  rows={4}
                  value={panel?.scene || ''}
                  onChange={e => updatePanel(0, { scene: e.target.value })}
                  placeholder="describe la escena..."
                  style={{ height: 'auto', minHeight: 84, overflowY: 'auto', resize: 'none', lineHeight: 1.5, paddingTop: 6, paddingBottom: 6 }}
                />
              </div>

              {/* Shot type + Hatch */}
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label className="label">plano (composición)</label>
                  <div className="radio-group">
                    {SHOT_TYPES.filter(st => st.scope === 'scene').map(st => (
                      <div
                        key={st.id}
                        className={`radio-pill ${panel?.shotType === st.id ? 'active' : ''}`}
                        onClick={() => updatePanel(0, { shotType: panel?.shotType === st.id ? null : st.id })}
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
                        onClick={() => updatePanel(0, { hatch: panel?.hatch === h.id ? null : h.id })}
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
                  <EntityMenu
                    options={projectCharacters}
                    value=""
                    placeholder="+ personaje..."
                    onSelect={(id) => { if (id) addCharacterToPanel(0, id) }}
                    style={{ fontSize: 12 }}
                  />
                  {panel?.characters?.length > 0 && (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {panel.characters.map((item, idx) => {
                        const char = characters.find(c => c.id === item.characterId)
                        return char ? (
                          <span
                            key={idx}
                            className="radio-pill"
                            style={{ fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, borderColor: char.color, color: char.color }}
                            onClick={() => { setSelectedCharIdx(idx); setSelectedObjIdx(null); setSelectedSfxIdx(null); setSelectedNarr(false); setSelectedBalloon(null); setSelectedBackground(false) }}
                          >
                            <span className="color-dot" style={{ background: char.color || '#999' }} />
                            {char.name}
                            <span style={{ cursor: 'pointer', fontWeight: 700, fontSize: 10 }} onClick={e => { e.stopPropagation(); removeCharacterFromPanel(0, idx) }}>x</span>
                          </span>
                        ) : null
                      })}
                    </div>
                  )}

                  {/* Background */}
                  <EntityMenu
                    options={projectBackgrounds}
                    value={panel?.backgroundId || ''}
                    placeholder="fondo..."
                    onSelect={(id) => setBackgroundForPanel(0, id || null)}
                    allowClear={!!panel?.backgroundId}
                    style={{ fontSize: 12 }}
                  />
                  {(() => {
                    const bgDef = panel?.backgroundId ? backgrounds.find(b => b.id === panel.backgroundId) : null
                    if (!bgDef?.comodin) return null
                    return (
                      <SpellCheckedTextarea
                        value={panel?.comodinDesc || ''}
                        onChange={e => updatePanel(0, { comodinDesc: e.target.value })}
                        placeholder="qué es este fondo: ej. 'un baldío detrás de un supermercado'..."
                        minRows={3}
                      />
                    )
                  })()}

                  {/* Objects */}
                  <EntityMenu
                    options={projectObjects}
                    value=""
                    placeholder="+ objeto..."
                    onSelect={(id) => { if (id) toggleObjectInPanel(0, id) }}
                    style={{ fontSize: 12 }}
                  />
                  {panel?.objects?.length > 0 && (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {panel.objects.map((item, idx) => {
                        const obj = objects.find(o => o.id === item.objectId)
                        return obj ? (
                          <span
                            key={idx}
                            className="radio-pill"
                            style={{ fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, borderColor: obj.color, color: obj.color }}
                            onClick={() => { setSelectedObjIdx(idx); setSelectedBackground(false) }}
                          >
                            <span className="color-dot" style={{ background: obj.color || '#999' }} />
                            {obj.name}
                            <span style={{ cursor: 'pointer', fontWeight: 700, fontSize: 10 }} onClick={e => { e.stopPropagation(); removeObjectFromPanel(0, idx) }}>x</span>
                          </span>
                        ) : null
                      })}
                    </div>
                  )}

                  {/* Globo X */}
                  <select
                    className="input"
                    value=""
                    onChange={e => { if (e.target.value) { addGloboXToPanel(0, e.target.value); e.target.value = '' } }}
                    style={{ fontSize: 12, cursor: 'pointer' }}
                  >
                    <option value="">+ globo X...</option>
                    {projectBalloons.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                  {(panel?.globosX || []).length > 0 && (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {panel.globosX.map((item, idx) => {
                        const textIdx = (panel.globosX || []).slice(0, idx + 1).filter(x => x.text).length
                        return (
                          <span
                            key={item.id}
                            className={`radio-pill ${selectedGloboXIdx === idx ? 'active' : ''}`}
                            style={{ fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                            onClick={() => { setSelectedGloboXIdx(selectedGloboXIdx === idx ? null : idx); setSelectedBackground(false) }}
                          >
                            X{textIdx || idx + 1}{item.text ? `: ${item.text.slice(0, 12)}` : ''}
                            <span style={{ cursor: 'pointer', fontWeight: 700, fontSize: 10 }} onClick={e => { e.stopPropagation(); removeGloboXFromPanel(0, idx) }}>x</span>
                          </span>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* SFX */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <label className="label" style={{ marginBottom: 0 }}>onomatopeyas</label>
                  <button className="btn btn-ghost btn-sm" onClick={() => addSfxToPanel(0)} style={{ fontSize: 11 }}>+ agregar</button>
                </div>
                {(panel?.sfx || []).length > 0 ? (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {(panel.sfx || []).map((s, i) => (
                      <span
                        key={i}
                        className={`radio-pill ${selectedSfxIdx === i ? 'active' : ''}`}
                        style={{ fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                        onClick={() => { setSelectedSfxIdx(selectedSfxIdx === i ? null : i); setSelectedBackground(false) }}
                      >
                        {s.text || '(vacío)'}
                        <span style={{ cursor: 'pointer', fontWeight: 700, fontSize: 10 }} onClick={(e) => { e.stopPropagation(); removeSfxFromPanel(0, i) }}>×</span>
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
                    onClick={() => { if (panel?.narration) removeNarrationFromPanel(0); else addNarrationToPanel(0); setSelectedNarr(true); setSelectedBackground(false) }}
                  />
                  <span style={{ fontSize: 12 }}>poner</span>
                </label>
                {panel?.narration && (
                  <>
                    <SpellCheckedTextarea
                      value={panel.narration.text || ''}
                      onChange={e => updateNarrationInPanel(0, { text: e.target.value })}
                      placeholder="texto del narrador..."
                      minRows={2}
                    />
                    <select
                      className="input"
                      value={panel.narration.balloonId || ''}
                      onChange={e => updateNarrationInPanel(0, { balloonId: e.target.value || null })}
                      style={{ fontSize: 12, cursor: 'pointer' }}
                    >
                      <option value="">estilo del globo (default del tipo)</option>
                      {projectBalloons.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
