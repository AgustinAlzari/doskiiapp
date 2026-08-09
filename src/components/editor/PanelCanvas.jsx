import { useState, useCallback, useRef, useEffect } from 'react'
import CharacterBlock from './CharacterBlock'
import ObjectBlock from './ObjectBlock'
import SFXBlock from './SFXBlock'
import NarrationBlock from './NarrationBlock'
import BalloonBlock from './BalloonBlock'
import ConnectionArrows from './ConnectionArrows'
import CompositionGuides from './CompositionGuides'
import { orderedPanelDialogues } from '../../services/promptGenerator'

export default function PanelCanvas({ panel, characters, objects, backgrounds, aspectRatio, grid, gridVisible, selectedCharIdx, selectedObjIdx, selectedSfxIdx, selectedNarr, selectedBalloon, selectedGloboXIdx, onSelectChar, onSelectObj, onSelectSfx, onSelectNarr, onSelectBalloon, onSelectGloboX, onUpdateChar, onUpdateObj, onUpdateSfx, onUpdateNarr, onRemoveChar, onRemoveObj, onRemoveSfx, onRemoveNarr, onRemoveBalloon, onRemoveGloboX, onMoveBalloon, onResizeBalloon, onMoveGloboX, onResizeGloboX, onRemoveBackground, onUpdateBackground, onUpdateHorizon, connections, onAddConnection, onRemoveConnection, onCanvasClick, canvasRef }) {
  const [connDrag, setConnDrag] = useState(null)
  const canvasRef2 = useRef(null)
  const wrapperRef = useRef(null)
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const el = wrapperRef.current
    if (!el) return
    const update = () => {
      const rect = el.getBoundingClientRect()
      setContainerSize(prev => (prev.width === Math.floor(rect.width) && prev.height === Math.floor(rect.height)) ? prev : { width: Math.floor(rect.width), height: Math.floor(rect.height) })
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const aspectW = aspectRatio === 'square' ? 1 : aspectRatio === 'vertical' || aspectRatio === 'portrait-hd' ? 9 : 16
  const aspectH = aspectRatio === 'square' ? 1 : aspectRatio === 'vertical' || aspectRatio === 'portrait-hd' ? 16 : 9
  const maxW = Math.min(containerSize.width || 820, 820)
  const maxH = containerSize.height || 9999
  let canvasW = maxW
  let canvasH = Math.round(canvasW * (aspectH / aspectW))
  if (canvasH > maxH) {
    canvasH = maxH
    canvasW = Math.round(canvasH * (aspectW / aspectH))
  }

  if (!panel) return null

  const panelObjects = panel.objects || []
  const panelSfx = panel.sfx || []
  const panelBackground = panel.background || (panel.backgroundId ? { x: 0.05, y: 0.1, width: 0.9, height: 0.45 } : null)
  const backgroundDef = backgrounds?.find(bg => bg.id === panel.backgroundId)
  const balloons = orderedPanelDialogues(panel, characters || [])

  const { linkSegments, tailSegments } = (() => {
    const byInstance = {}
    balloons.forEach(b => { (byInstance[b.name] = byInstance[b.name] || []).push(b) })
    const links = []
    const tails = []
    Object.values(byInstance).forEach(list => {
      for (let i = 0; i < list.length - 1; i++) {
        const a = list[i]
        const b = list[i + 1]
        links.push({
          x1: (a.x + a.width / 2) * 100,
          y1: (a.y + a.height / 2) * 100,
          x2: (b.x + b.width / 2) * 100,
          y2: (b.y + b.height / 2) * 100,
        })
      }
      const last = list[list.length - 1]
      const ch = (panel.characters || [])[last.charIdx]
      if (ch) {
        tails.push({
          x1: (last.x + last.width / 2) * 100,
          y1: (last.y + last.height / 2) * 100,
          x2: (ch.x + ch.width / 2) * 100,
          y2: (ch.y + ch.height * 0.3) * 100,
        })
      }
    })
    ;(panel.globosX || []).forEach(g => {
      if (!g.text) return
      const a = g.anchor || {}
      const x1 = (g.x + g.width / 2) * 100
      const y1 = (g.y + g.height / 2) * 100
      let x2 = null
      let y2 = null
      if (a.type === 'character') {
        const ch = (panel.characters || []).find(c => c.characterId === a.id)
        if (ch) { x2 = (ch.x + ch.width / 2) * 100; y2 = (ch.y + ch.height * 0.3) * 100 }
      } else if (a.type === 'object') {
        const o = (panel.objects || []).find(o => o.objectId === a.id)
        if (o) { x2 = (o.x + o.width / 2) * 100; y2 = (o.y + o.height / 2) * 100 }
      } else if (a.type === 'narration') {
        const n = panel.narration
        if (n) { x2 = (n.x + n.width / 2) * 100; y2 = (n.y + n.height / 2) * 100 }
      } else if (a.type === 'offpanel') {
        const dir = a.direction || 'bottom'
        if (dir === 'left') { x2 = -4; y2 = y1 }
        else if (dir === 'right') { x2 = 104; y2 = y1 }
        else if (dir === 'top') { x2 = x1; y2 = -4 }
        else { x2 = x1; y2 = 104 }
      }
      if (x2 != null) tails.push({ x1, y1, x2, y2 })
    })
    return { linkSegments: links, tailSegments: tails }
  })()

  const handleConnOutStart = useCallback((characterId, e) => {
    const canvas = canvasRef2.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const fromChar = panel.characters.find(c => c.characterId === characterId)
    if (!fromChar) return
    const portOffset = 18 / rect.height
    const startX = fromChar.x
    const startY = fromChar.y - portOffset
    setConnDrag({ fromId: characterId, startX, startY, currentX: startX, currentY: startY })

    const handleMove = (ev) => {
      const x = (ev.clientX - rect.left) / rect.width
      const y = (ev.clientY - rect.top) / rect.height
      setConnDrag(prev => prev ? { ...prev, currentX: Math.max(0, Math.min(1, x)), currentY: Math.max(0, Math.min(1, y)) } : null)
    }

    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
      setConnDrag(null)
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
  }, [panel.characters])

  const handleConnInEnd = useCallback((targetType, targetId) => {
    if (!connDrag) return
    if (targetType === 'character' && connDrag.fromId === targetId) {
      setConnDrag(null)
      return
    }
    const exists = connections.some(c => c.from === connDrag.fromId && c.to === targetId && (c.toType || 'character') === targetType)
    if (!exists) {
      onAddConnection(connDrag.fromId, targetId, targetType)
    }
    setConnDrag(null)
  }, [connDrag, connections, onAddConnection])

  const getPortScreenPos = useCallback((characterId, type) => {
    const ch = panel.characters.find(c => c.characterId === characterId)
    if (!ch) return null
    const rect = canvasRef2.current?.getBoundingClientRect()
    const portOffset = rect ? 18 / rect.height : 0.035
    if (type === 'out') return { x: ch.x, y: ch.y - portOffset }
    return { x: ch.x + ch.width, y: ch.y - portOffset }
  }, [panel.characters])

  const getObjectPortScreenPos = useCallback((objectId) => {
    const obj = panelObjects.find(item => item.objectId === objectId)
    const rect = canvasRef2.current?.getBoundingClientRect()
    const portOffset = rect ? 18 / rect.height : 0.035
    return obj ? { x: obj.x + obj.width / 2, y: obj.y - portOffset } : null
  }, [panelObjects])

  const getBackgroundPortScreenPos = useCallback(() => {
    const rect = canvasRef2.current?.getBoundingClientRect()
    const portOffset = rect ? 18 / rect.height : 0.035
    return panelBackground ? { x: panelBackground.x + panelBackground.width / 2, y: panelBackground.y - portOffset } : null
  }, [panelBackground])

  const setCanvasRef = useCallback((el) => {
    canvasRef.current = el
    canvasRef2.current = el
  }, [])

  return (
    <div ref={wrapperRef} style={{ width: '100%', height: '100%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div ref={setCanvasRef} className="panel-canvas" style={{ width: canvasW || '100%', height: canvasH || '100%' }} onMouseDown={e => { const t = e.target; if (t === e.currentTarget || (t.style.pointerEvents === 'none' && t.parentElement === e.currentTarget)) onCanvasClick?.() }}>
        <CompositionGuides grid={grid} visible={gridVisible} horizon={panel.horizon} onMoveHorizon={y => onUpdateHorizon?.({ ...panel.horizon, y })} />
        {panelBackground && backgroundDef && (
          <ObjectBlock
            panelObj={panelBackground}
            objDef={backgroundDef}
            isBackground
            showInputPort={true}
            onSelect={() => {}}
            onMove={(x, y) => onUpdateBackground({ x, y })}
            onResize={(updates) => onUpdateBackground(updates)}
            onRemove={() => onRemoveBackground?.()}
            onConnInEnd={() => handleConnInEnd('background', panel.backgroundId)}
          />
        )}
        {panel.characters.length === 0 && panelObjects.length === 0 && panelSfx.length === 0 && (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-text-muted)',
            fontSize: 13,
            pointerEvents: 'none',
          }}>
            añade personajes, objetos o onomatopeyas desde abajo
          </div>
        )}

        {panelSfx.map((s, idx) => (
          <SFXBlock
            key={idx}
            sfx={s}
            isSelected={selectedSfxIdx === idx}
            onSelect={() => onSelectSfx(idx)}
            onMove={(x, y) => onUpdateSfx(idx, { x, y })}
            onResize={(width, height) => onUpdateSfx(idx, { width, height })}
            onUpdate={(updates) => onUpdateSfx(idx, updates)}
            onRemove={() => onRemoveSfx?.(idx)}
          />
        ))}

        {panel.narration && (
          <NarrationBlock
            panelNarr={panel.narration}
            isSelected={selectedNarr}
            onSelect={onSelectNarr}
            onMove={(x, y) => onUpdateNarr({ x, y })}
            onResize={(updates) => onUpdateNarr(updates)}
            onRemove={onRemoveNarr}
          />
        )}

        <ConnectionArrows
          connections={connections}
          panelCharacters={panel.characters}
          characters={characters}
          getPortScreenPos={getPortScreenPos}
          getObjectPortScreenPos={getObjectPortScreenPos}
          getBackgroundPortScreenPos={getBackgroundPortScreenPos}
          objects={objects}
          backgrounds={backgrounds}
        />

        {/* Temporary connection line while dragging */}
        {connDrag && (
          <svg
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
              zIndex: 15,
              overflow: 'visible',
            }}
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            <line
              x1={connDrag.startX * 100}
              y1={connDrag.startY * 100}
              x2={connDrag.currentX * 100}
              y2={connDrag.currentY * 100}
              stroke="#777"
              strokeWidth="0.22"
              strokeDasharray="0.7 0.7"
              vectorEffect="non-scaling-stroke"
              opacity="0.7"
            />
            <circle
              cx={connDrag.currentX * 100}
              cy={connDrag.currentY * 100}
              r="0.25"
              fill="#777"
              opacity="0.7"
            />
          </svg>
        )}

        {panelObjects.map((obj, idx) => {
          const objDef = objects.find(o => o.id === obj.objectId)
          if (!objDef) return null
          return (
            <ObjectBlock
              key={`${obj.objectId}-${idx}`}
              panelObj={obj}
              objDef={objDef}
              isSelected={selectedObjIdx === idx}
              onSelect={() => onSelectObj(idx)}
              onMove={(x, y) => onUpdateObj(idx, { x, y })}
              onResize={(updates) => onUpdateObj(idx, updates)}
              onRemove={() => onRemoveObj?.(idx)}
              onConnInEnd={(id) => handleConnInEnd('object', id)}
              isConnDrag={!!connDrag}
            />
          )
        })}

        {panel.characters.map((ch, idx) => {
          const charDef = characters.find(c => c.id === ch.characterId)
          if (!charDef) return null
          return (
            <CharacterBlock
              key={`${ch.characterId}-${idx}`}
              panelChar={ch}
              charDef={charDef}
              isSelected={selectedCharIdx === idx}
              onSelect={() => onSelectChar(idx)}
              onMove={(x, y) => onUpdateChar(idx, { x, y })}
              onResize={(updates) => onUpdateChar(idx, updates)}
              onRemove={() => onRemoveChar?.(idx)}
              onConnOutStart={handleConnOutStart}
              onConnInEnd={(id) => handleConnInEnd('character', id)}
              isConnDrag={!!connDrag}
              connDragFrom={connDrag?.fromId}
            />
          )
        })}

        {/* Balloon lines: links between balloons + tail to character */}
        {(linkSegments.length > 0 || tailSegments.length > 0) && (
          <svg
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 12, overflow: 'visible' }}
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            {linkSegments.map((seg, idx) => (
              <line
                key={`link-${idx}`}
                x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2}
                stroke="#c0392b"
                strokeWidth="0.7"
                strokeDasharray="3 3"
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {tailSegments.map((seg, idx) => (
              <line
                key={`tail-${idx}`}
                x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2}
                stroke="#c0392b"
                strokeWidth="0.7"
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>
        )}

        {/* Dialogue balloons (graphic indications, top layer) */}
        {balloons.map((b) => (
          <BalloonBlock
            key={`${b.characterId}-${b.isExtra ? `extra-${b.extraIdx}` : 'main'}`}
            balloon={b}
            isSelected={
              selectedBalloon &&
              selectedBalloon.characterId === b.characterId &&
              selectedBalloon.isExtra === b.isExtra &&
              selectedBalloon.extraIdx === b.extraIdx
            }
            onSelect={() => onSelectBalloon?.(b)}
            onMove={(x, y) => onMoveBalloon?.(b, { x, y })}
            onResize={(updates) => onResizeBalloon?.(b, updates)}
            onRemove={() => onRemoveBalloon?.(b)}
          />
        ))}

        {/* Globo X blocks (free balloons, top layer) */}
        {(panel.globosX || []).map((g, idx) => {
          const textIdx = (panel.globosX || []).slice(0, idx + 1).filter(x => x.text).length
          return (
            <BalloonBlock
              key={g.id || `globox-${idx}`}
              balloon={{ ...g, type: g.channel || 'speech', label: `X${textIdx || idx + 1}`, number: textIdx || idx + 1 }}
              isSelected={selectedGloboXIdx === idx}
              onSelect={() => onSelectGloboX?.(idx)}
              onMove={(x, y) => onMoveGloboX?.(idx, { x, y })}
              onResize={(updates) => onResizeGloboX?.(idx, updates)}
              onRemove={() => onRemoveGloboX?.(idx)}
            />
          )
        })}
      </div>
    </div>
  )
}
