import { useState, useCallback, useRef, useEffect } from 'react'
import CharacterBlock from './CharacterBlock'
import ObjectBlock from './ObjectBlock'
import SFXBlock from './SFXBlock'
import NarrationBlock from './NarrationBlock'
import BalloonBlock from './BalloonBlock'
import ConnectionArrows from './ConnectionArrows'
import CompositionGuides from './CompositionGuides'
import SignatureBlock from './SignatureBlock'
import { orderedPanelDialogues } from '../../services/promptGenerator'
import { ASPECT_RATIOS } from '../../data/actionPresets'

function OffFrameTab({ tab }) {
  const start = useRef(null)

  const onDown = (e) => {
    e.stopPropagation()
    tab.onSelect?.()
    const canvas = e.currentTarget.parentElement
    start.current = { mx: e.clientX, my: e.clientY, x: tab.el.x, y: tab.el.y }
    const move = (ev) => {
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const dx = (ev.clientX - start.current.mx) / rect.width
      const dy = (ev.clientY - start.current.my) / rect.height
      tab.onMove?.(
        Math.max(-0.6, Math.min(1.6 - tab.el.width, start.current.x + dx)),
        Math.max(-0.6, Math.min(1.6 - tab.el.height, start.current.y + dy))
      )
    }
    const up = () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  const base = { position: 'absolute', zIndex: 70, pointerEvents: 'auto', cursor: 'grab', background: 'var(--color-elevated)', border: '1px solid var(--color-border)', borderRadius: 4, fontSize: 9, padding: '2px 6px', color: 'var(--color-text-2)', boxShadow: '0 2px 6px rgba(0,0,0,0.15)', whiteSpace: 'nowrap', maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis' }
  const style =
    tab.edge === 'left' ? { left: 3, top: `calc(${tab.pos * 100}% - 10px)` }
    : tab.edge === 'right' ? { right: 3, top: `calc(${tab.pos * 100}% - 10px)` }
    : tab.edge === 'top' ? { top: 3, left: `calc(${tab.pos * 100}% - 40px)` }
    : { bottom: 3, left: `calc(${tab.pos * 100}% - 40px)` }

  return (
    <div onMouseDown={onDown} style={{ ...base, ...style }} title={`${tab.name} — fuera de campo (arrastrá para volver al lienzo)`}>
      {tab.name} <span style={{ opacity: 0.6 }}>⇢</span>
    </div>
  )
}

function BehindOutline({ el, onSelect, onMove }) {
  const start = useRef(null)

  const onDown = (e) => {
    e.stopPropagation()
    onSelect?.()
    const canvas = e.currentTarget.parentElement
    start.current = { mx: e.clientX, my: e.clientY, x: el.x, y: el.y }
    const move = (ev) => {
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const dx = (ev.clientX - start.current.mx) / rect.width
      const dy = (ev.clientY - start.current.my) / rect.height
      onMove?.(
        Math.max(-0.6, Math.min(1.6 - el.width, start.current.x + dx)),
        Math.max(-0.6, Math.min(1.6 - el.height, start.current.y + dy))
      )
    }
    const up = () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  return (
    <div
      onMouseDown={onDown}
      title="elemento detrás de otro: arrastralo"
      style={{
        position: 'absolute',
        left: `${el.x * 100}%`,
        top: `${el.y * 100}%`,
        width: `${el.width * 100}%`,
        height: `${el.height * 100}%`,
        border: '1.5px dashed var(--color-text-muted)',
        borderRadius: 4,
        opacity: 0.7,
        pointerEvents: 'auto',
        cursor: 'grab',
        zIndex: 60,
      }}
    />
  )
}

export default function PanelCanvas({ panel, characters, objects, backgrounds, aspectRatio, grid, gridVisible, selectedCharIdx, selectedObjIdx, selectedSfxIdx, selectedNarr, selectedBalloon, selectedGloboXIdx, selectedBackground, onSelectBackground, onSelectChar, onSelectObj, onSelectSfx, onSelectNarr, onSelectBalloon, onSelectGloboX, onUpdateChar, onUpdateObj, onUpdateSfx, onUpdateNarr, onRemoveChar, onRemoveObj, onRemoveSfx, onRemoveNarr, onRemoveBalloon, onRemoveGloboX, onMoveBalloon, onResizeBalloon, onTextBalloon, onMoveGloboX, onResizeGloboX, onTextGloboX, onTextNarr, onRemoveBackground, onUpdateBackground, onUpdateHorizon, connections, onAddConnection, onRemoveConnection, onCanvasClick, canvasRef, signature, selectedSignature, onSelectSignature, onUpdateSignature, onRemoveSignature, signatureColor, signatureText, signatureImagePath }) {
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

  const ar = ASPECT_RATIOS.find(a => a.id === aspectRatio)
  const ratioParts = (ar?.ratio || '16:9').split(':').map(Number)
  const aspectW = ratioParts[0] || 16
  const aspectH = ratioParts[1] || 9
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
  const balloons = orderedPanelDialogues(panel, characters || [], { includeEmpty: true })

  const overlap = (a, b) => !(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y)
  const BASE = { obj: 1000, char: 2000, sfx: 3000, gx: 4000 }
  const charName = (id) => characters?.find(c => c.id === id)?.name || '?'
  const objName = (id) => objects?.find(o => o.id === id)?.name || '?'
  const blocks = [
    ...panelObjects.map((o, i) => ({ key: `obj-${i}`, el: o, name: objName(o.objectId), prio: (o.z ?? 0) * 10000 + BASE.obj + i, onSelect: () => onSelectObj?.(i), onMove: (x, y) => onUpdateObj?.(i, { x, y }) })),
    ...panel.characters.map((c, i) => ({ key: `char-${i}`, el: c, name: charName(c.characterId), prio: (c.z ?? 0) * 10000 + BASE.char + i, onSelect: () => onSelectChar?.(i), onMove: (x, y) => onUpdateChar?.(i, { x, y }) })),
    ...panelSfx.map((s, i) => ({ key: `sfx-${i}`, el: s, name: s.text?.trim() ? `"${s.text.trim()}"` : 'onomatopeya', prio: (s.z ?? 0) * 10000 + BASE.sfx + i, onSelect: () => onSelectSfx?.(i), onMove: (x, y) => onUpdateSfx?.(i, { x, y }) })),
    ...(panel.globosX || []).map((g, i) => ({ key: `gx-${i}`, el: g, name: `X${i + 1}`, prio: (g.z ?? 0) * 10000 + BASE.gx + i, onSelect: () => onSelectGloboX?.(i), onMove: (x, y) => onMoveGloboX?.(i, { x, y }) })),
  ]
  const behindRects = blocks.filter(b => blocks.some(o => o !== b && o.prio > b.prio && overlap(b.el, o.el)))
  const blockByKey = Object.fromEntries(blocks.map(b => [b.key, b]))

  // Ciclo de selección por doble clic: si un elemento está detrás de otro, el
  // doble clic sobre el de adelante selecciona el siguiente de la pila (el de
  // atrás). Repetir el doble clic sobre la misma zona baja un puesto más.
  const behindRef = useRef(null)
  const selectBehind = useCallback((b) => {
    if (!b) return
    const stack = blocks
      .filter(x => overlap(b.el, x.el))
      .sort((a, z) => z.prio - a.prio)
    if (stack.length < 2) return
    let idx = 0
    if (behindRef.current?.key === b.key) idx = behindRef.current.idx
    idx = (idx + 1) % stack.length
    behindRef.current = { key: b.key, idx }
    stack[idx].onSelect()
  }, [blocks])
  const offFrameTabs = (() => {
    const tabs = []
    for (const b of blocks) {
      const e = b.el
      const fullyLeft = e.x + e.width <= 0
      const fullyRight = e.x >= 1
      const fullyTop = e.y + e.height <= 0
      const fullyBottom = e.y >= 1
      if (!fullyLeft && !fullyRight && !fullyTop && !fullyBottom) continue
      const outLeft = fullyLeft ? -(e.x + e.width) : 0
      const outRight = fullyRight ? e.x - 1 : 0
      const outTop = fullyTop ? -(e.y + e.height) : 0
      const outBottom = fullyBottom ? e.y - 1 : 0
      const max = Math.max(outLeft, outRight, outTop, outBottom)
      const cy = Math.max(0.05, Math.min(0.95, e.y + e.height / 2))
      const cx = Math.max(0.05, Math.min(0.95, e.x + e.width / 2))
      let edge, pos
      if (max === outRight) { edge = 'right'; pos = cy }
      else if (max === outLeft) { edge = 'left'; pos = cy }
      else if (max === outBottom) { edge = 'bottom'; pos = cx }
      else { edge = 'top'; pos = cx }
      tabs.push({ key: b.key, el: e, edge, pos, name: b.name, onSelect: b.onSelect, onMove: b.onMove })
    }
    return tabs
  })()

  const { linkSegments, tailSegments } = (() => {
    const byInstance = {}
    balloons.forEach(b => { (byInstance[b.name] = byInstance[b.name] || []).push(b) })
    const links = []
    const tails = []
    Object.values(byInstance).forEach(list => {
      for (let i = 0; i < list.length - 1; i++) {
        const a = list[i]
        const b = list[i + 1]
        if (!b.linked) continue
        links.push({
          x1: (a.x + a.width / 2) * 100,
          y1: (a.y + a.height / 2) * 100,
          x2: (b.x + b.width / 2) * 100,
          y2: (b.y + b.height / 2) * 100,
        })
      }
      // Cola por grupo: cada serie de globos conectados (linked) termina en una
      // cola hacia el hablante; un globo desconectado forma su propio grupo con
      // cola propia. Así el grupo anterior conserva su cola aunque el último se
      // haya desconectado.
      for (let i = 0; i < list.length; i++) {
        const isGroupEnd = i === list.length - 1 || !list[i + 1].linked
        if (!isGroupEnd) continue
        const last = list[i]
        const ch = (panel.characters || [])[last.charIdx]
        if (ch) {
          tails.push({
            x1: (last.x + last.width / 2) * 100,
            y1: (last.y + last.height / 2) * 100,
            x2: (ch.x + ch.width / 2) * 100,
            y2: (ch.y + ch.height * 0.3) * 100,
          })
        }
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
    const portOffset = 10 / rect.height
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
    const portOffset = rect ? 10 / rect.height : 0.02
    if (type === 'out') return { x: ch.x, y: ch.y - portOffset }
    return { x: ch.x + ch.width, y: ch.y - portOffset }
  }, [panel.characters])

  const getObjectPortScreenPos = useCallback((objectId) => {
    const obj = panelObjects.find(item => item.objectId === objectId)
    const rect = canvasRef2.current?.getBoundingClientRect()
    const portOffset = rect ? 10 / rect.height : 0.02
    return obj ? { x: obj.x + obj.width / 2, y: obj.y - portOffset } : null
  }, [panelObjects])

  const getBackgroundPortScreenPos = useCallback(() => {
    const rect = canvasRef2.current?.getBoundingClientRect()
    const portOffset = rect ? 10 / rect.height : 0.02
    return panelBackground ? { x: panelBackground.x + panelBackground.width / 2, y: panelBackground.y - portOffset } : null
  }, [panelBackground])

  const setCanvasRef = useCallback((el) => {
    canvasRef.current = el
    canvasRef2.current = el
  }, [])

  return (
    <div ref={wrapperRef} style={{ width: '100%', height: '100%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div ref={setCanvasRef} className="panel-canvas" style={{ width: canvasW || '100%', height: canvasH || '100%' }} onMouseDown={e => { const t = e.target; if (t === e.currentTarget || (t.style.pointerEvents === 'none' && t.parentElement === e.currentTarget)) onCanvasClick?.() }}>
        <CompositionGuides grid={grid} visible={gridVisible} horizon={panel.horizon} onMoveHorizon={next => onUpdateHorizon?.({ ...panel.horizon, ...next })} />
        {panelBackground && backgroundDef && (
          <ObjectBlock
            panelObj={panelBackground}
            objDef={backgroundDef}
            isBackground
            isSelected={selectedBackground}
            showInputPort={true}
            onSelect={() => onSelectBackground?.()}
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
            onDoubleClick={() => selectBehind(blockByKey[`sfx-${idx}`])}
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
            onText={(text) => onTextNarr?.(text)}
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
              onDoubleClick={() => selectBehind(blockByKey[`obj-${idx}`])}
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
              onDoubleClick={() => selectBehind(blockByKey[`char-${idx}`])}
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
            onText={(text) => onTextBalloon?.(b, text)}
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
              onDoubleClick={() => selectBehind(blockByKey[`gx-${idx}`])}
              onMove={(x, y) => onMoveGloboX?.(idx, { x, y })}
              onResize={(updates) => onResizeGloboX?.(idx, updates)}
              onText={(text) => onTextGloboX?.(idx, text)}
              onRemove={() => onRemoveGloboX?.(idx)}
            />
          )
        })}

        {panel.signature && (
          <SignatureBlock
            signature={panel.signature}
            color={signatureColor}
            text={signatureText}
            imagePath={signatureImagePath}
            isSelected={selectedSignature}
            onSelect={() => onSelectSignature?.()}
            onMove={(x, y) => onUpdateSignature?.({ x, y })}
            onResize={(updates) => onUpdateSignature?.(updates)}
            onRemove={() => onRemoveSignature?.()}
          />
        )}

        {/* Contornos punteados de elementos que quedan detrás de otro */}
        {behindRects.map(r => (
          <BehindOutline key={r.key} el={r.el} onSelect={r.onSelect} onMove={r.onMove} />
        ))}

        {/* Solapas para elementos 100% fuera de campo */}
        {offFrameTabs.map(t => (
          <OffFrameTab key={t.key} tab={t} />
        ))}
      </div>
    </div>
  )
}
