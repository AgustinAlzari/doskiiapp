import { useEffect, useState } from 'react'
import useBackgroundStore from '../../store/backgroundStore'
import useObjectStore from '../../store/objectStore'
import { generateAllPanelsPrompt, generateScenePrompt, generateLetteringPrompt, usedBalloonTypes, orderedPanelDialogues, sceneLayoutFileNameFor, letteringLayoutFileNameFor } from '../../services/promptGenerator'
import { ASPECT_RATIOS } from '../../data/actionPresets'

function generateCanvasSVG(panel, characters, backgrounds, objects, stripAspectRatio, mode = 'scene') {
  const ar = ASPECT_RATIOS.find(a => a.id === stripAspectRatio)
  const ratioParts = ar ? ar.ratio.split(':').map(Number) : [16, 9]
  const svgW = 400
  const svgH = Math.round(svgW * (ratioParts[1] / ratioParts[0]))

  const rects = []

  if (mode === 'scene') {
    if (panel.backgroundId) {
      const bg = panel.background || { x: 0, y: 0, width: 1, height: 0.5 }
      const def = backgrounds.find(b => b.id === panel.backgroundId)
      rects.push({ x: bg.x * svgW, y: bg.y * svgH, w: bg.width * svgW, h: bg.height * svgH, stroke: '#999', fill: 'rgba(0,0,0,0.04)', label: def?.name || 'fondo' })
    }

    ;(panel.characters || []).forEach((ch, i) => {
      const def = characters.find(c => c.id === ch.characterId)
      rects.push({ x: ch.x * svgW, y: ch.y * svgH, w: ch.width * svgW, h: ch.height * svgH, stroke: def?.color || '#333', fill: 'none', label: def?.name || `P${i + 1}` })
    })

    ;(panel.objects || []).forEach((obj, i) => {
      const def = objects.find(o => o.id === obj.objectId)
      rects.push({ x: obj.x * svgW, y: obj.y * svgH, w: obj.width * svgW, h: obj.height * svgH, stroke: def?.color || '#666', fill: 'none', label: def?.name || `O${i + 1}` })
    })
  } else {
    if (panel.narration && panel.narration.text) {
      const n = panel.narration
      rects.push({ x: n.x * svgW, y: n.y * svgH, w: n.width * svgW, h: n.height * svgH, stroke: '#007aff', fill: 'none', dash: n.framed ? 'none' : '4 3', label: 'narración' })
    }

    const balloons = orderedPanelDialogues(panel, characters || [])
    balloons.forEach(b => {
      rects.push({ x: b.x * svgW, y: b.y * svgH, w: b.width * svgW, h: b.height * svgH, stroke: b.type === 'thought' ? '#7d3cff' : '#e04040', fill: 'rgba(0,0,0,0.03)', dash: '4 3', label: `${b.number}. ${b.label}` })
    })

    ;(panel.sfx || []).forEach((s) => {
      if (s.text) rects.push({ x: s.x * svgW, y: s.y * svgH, w: s.width * svgW, h: s.height * svgH, stroke: '#e67e22', fill: 'none', label: s.text })
    })
  }

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgW} ${svgH}" width="${svgW}" height="${svgH}">`
  svg += `<rect x="0" y="0" width="${svgW}" height="${svgH}" fill="white" stroke="#000" stroke-width="1"/>`

  rects.forEach(r => {
    const dash = r.dash ? ` stroke-dasharray="${r.dash}"` : ''
    svg += `<rect x="${Math.round(r.x)}" y="${Math.round(r.y)}" width="${Math.round(r.w)}" height="${Math.round(r.h)}" fill="${r.fill}" stroke="${r.stroke}" stroke-width="1.5"${dash}/>`
    const labelX = Math.round(r.x + r.w / 2)
    const labelY = Math.round(r.y + r.h / 2)
    svg += `<text x="${labelX}" y="${labelY}" text-anchor="middle" dominant-baseline="central" font-family="monospace" font-size="10" fill="${r.stroke}">${r.label}</text>`
  })

  if (mode === 'lettering') {
    const balloons = orderedPanelDialogues(panel, characters || [])
    const byInstance = {}
    balloons.forEach(b => { (byInstance[b.name] = byInstance[b.name] || []).push(b) })
    Object.values(byInstance).forEach(list => {
      for (let i = 0; i < list.length - 1; i++) {
        const a = list[i]
        const b = list[i + 1]
        const x1 = Math.round((a.x + a.width / 2) * svgW)
        const y1 = Math.round((a.y + a.height / 2) * svgH)
        const x2 = Math.round((b.x + b.width / 2) * svgW)
        const y2 = Math.round((b.y + b.height / 2) * svgH)
        svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#c0392b" stroke-width="0.5"/>`
      }
    })
    Object.values(byInstance).forEach(list => {
      const last = list[list.length - 1]
      const ch = (panel.characters || [])[last.charIdx]
      if (!ch) return
      const bx = Math.round((last.x + last.width / 2) * svgW)
      const by = Math.round((last.y + last.height / 2) * svgH)
      const cx = Math.round((ch.x + ch.width / 2) * svgW)
      const cy = Math.round((ch.y + ch.height * 0.3) * svgH)
      svg += `<line x1="${bx}" y1="${by}" x2="${cx}" y2="${cy}" stroke="#c0392b" stroke-width="0.5"/>`
    })
  }

  svg += '</svg>'
  return svg
}

export default function PromptExporter({ strip, characters, project }) {
  const backgrounds = useBackgroundStore(s => s.backgrounds)
  const objects = useObjectStore(s => s.objects)
  const [copied, setCopied] = useState(null)
  const [svgPaths, setSvgPaths] = useState({})
  const [showVectors, setShowVectors] = useState(false)
  const [generating, setGenerating] = useState(false)

  const chars = characters || []
  const bgs = backgrounds || []
  const objs = objects || []

  if (!strip || !strip.panels) return <div style={{ padding: 16 }}>cargando prompts...</div>

  const resolvedAspect = strip.aspectRatio || project?.defaultAspectRatio || 'hd'

  let allPrompts = ''
  try {
    allPrompts = generateAllPanelsPrompt(strip, chars, bgs, objs, project)
  } catch {
    allPrompts = 'Error generando prompts'
  }

  const generateVectors = async () => {
    setGenerating(true)
    setShowVectors(true)
    for (let i = 0; i < (strip.panels || []).length; i++) {
      try {
        const panel = strip.panels[i]
        const sceneSvg = generateCanvasSVG(panel, chars, bgs, objs, resolvedAspect, 'scene')
        const letteringSvg = generateCanvasSVG(panel, chars, bgs, objs, resolvedAspect, 'lettering')
        const scenePath = await svgToJPG(sceneSvg, sceneLayoutFileNameFor(strip, i))
        const letteringPath = await svgToJPG(letteringSvg, letteringLayoutFileNameFor(strip, i))
        if (scenePath) setSvgPaths(prev => ({ ...prev, [`${i}:scene`]: scenePath }))
        if (letteringPath) setSvgPaths(prev => ({ ...prev, [`${i}:lettering`]: letteringPath }))
      } catch (err) {
        console.error(`Error generating layout panel ${i}:`, err)
      }
    }
    setGenerating(false)
  }

  const svgToJPG = (svgString, fileName) => {
    return new Promise((resolve) => {
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
      const url = URL.createObjectURL(svgBlob)
      const img = new Image()
      img.onload = async () => {
        const canvas = document.createElement('canvas')
        canvas.width = 800
        canvas.height = 800
        const ctx = canvas.getContext('2d')
        ctx.fillStyle = 'white'
        ctx.fillRect(0, 0, 800, 800)
        ctx.drawImage(img, 0, 0, 800, 800)
        URL.revokeObjectURL(url)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.95)
        const base64 = dataUrl.split(',')[1]
        if (window.api?.references?.saveFile) {
          const result = await window.api.references.saveFile({ fileName, data: base64 })
          resolve(result?.path || null)
        } else {
          resolve(null)
        }
      }
      img.onerror = () => { URL.revokeObjectURL(url); resolve(null) }
      img.src = url
    })
  }

  const copyToClipboard = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(label)
    setTimeout(() => setCopied(null), 2000)
  }

  const exportToFile = async (content, filename) => {
    if (window.api?.dialog) {
      const result = await window.api.dialog.save({
        defaultPath: filename,
        filters: [{ name: 'Text', extensions: ['txt'] }],
      })
      if (!result.canceled && result.filePath) {
        const blob = new Blob([content], { type: 'text/plain' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = result.filePath.split('/').pop()
        a.click()
        URL.revokeObjectURL(url)
      }
    } else {
      const blob = new Blob([content], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  const balloonRefs = (() => {
    const balloons = project?.balloons
    if (!balloons) return []
    const used = new Set()
    ;(strip.panels || []).forEach(panel => usedBalloonTypes(panel).forEach(t => used.add(t)))
    const label = { narration: 'globo narrador', speech: 'globo diálogo', thought: 'globo pensamiento' }
    return [...used].filter(type => balloons[type]?.fileName).map(type => ({
      fileName: balloons[type].fileName,
      path: balloons[type].path,
      entityName: label[type] || 'globo',
      balloonType: type,
    }))
  })()

  const references = [
    ...chars.flatMap(item => (item.referenceImages || []).map(image => ({ ...image, entityName: item.name }))),
    ...bgs.flatMap(item => (item.referenceImages || []).map(image => ({ ...image, entityName: item.name }))),
    ...objs.flatMap(item => (item.referenceImages || []).map(image => ({ ...image, entityName: item.name }))),
    ...balloonRefs,
  ]

  const usedIds = new Set([
    ...strip.panels.flatMap(p => (p.characters || []).map(c => c.characterId)),
    ...strip.panels.flatMap(p => (p.objects || []).map(o => o.objectId)),
    ...strip.panels.filter(p => p.backgroundId).map(p => p.backgroundId),
  ])
  const usedReferences = references.filter(ref => {
    if (ref.balloonType) return true
    const entity = [...chars, ...bgs, ...objs].find(e => e.name === ref.entityName)
    return entity && usedIds.has(entity.id)
  })

  const usedFileNames = [...new Set([
    ...usedReferences.map(r => r.fileName),
    ...Object.keys(svgPaths).map(key => {
      const [idx, mode] = key.split(':')
      return mode === 'scene' ? sceneLayoutFileNameFor(strip, Number(idx)) : letteringLayoutFileNameFor(strip, Number(idx))
    }),
  ])]

  const openUsedFolder = async () => {
    if (!window.api?.references?.openUsedFolder) {
      alert('reiniciá la app para activar "abrir carpeta"')
      return
    }
    await window.api.references.openUsedFolder(usedFileNames)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Export all */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-sm" onClick={() => copyToClipboard(allPrompts, 'all')}>
          {copied === 'all' ? 'copiado ✓' : 'copiar todos'}
        </button>
        <button className="btn btn-sm" onClick={() => exportToFile(allPrompts, `${strip.title || 'tira'}-prompts.txt`)}>
          exportar .txt
        </button>
      </div>

      {/* Referencias + vectores — todo arriba */}
      {(usedReferences.length > 0 || showVectors) && (
        <div className="card" style={{ padding: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600 }}>referencias para arrastrar a la IA</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn btn-sm" onClick={openUsedFolder} disabled={!usedFileNames.length}>
                abrir carpeta
              </button>
              <button className="btn btn-sm" onClick={generateVectors} disabled={generating}>
                {generating ? 'generando...' : showVectors ? 'ocultar vectores' : 'generar vectores'}
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {usedReferences.map(reference => (
              <div key={reference.path} style={{ width: 100, fontSize: 10, color: 'var(--color-text-muted)' }}>
                <div style={{ height: 78, border: '1px solid var(--color-border)', borderRadius: 5, padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {window.api?.references?.read && <ReferenceThumbnail reference={reference} />}
                </div>
                <div style={{ marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={reference.fileName}>{reference.fileName}</div>
              </div>
            ))}
            {showVectors && Object.keys(svgPaths).map(key => {
              const [idx, mode] = key.split(':')
              const fileName = mode === 'scene' ? sceneLayoutFileNameFor(strip, Number(idx)) : letteringLayoutFileNameFor(strip, Number(idx))
              return (
                <div key={`layout-${key}`} style={{ width: 100, fontSize: 10, color: 'var(--color-text-muted)' }}>
                  <div style={{ height: 78, border: '1px solid var(--color-border)', borderRadius: 5, padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {window.api?.references?.read && <ReferenceThumbnail reference={{ path: svgPaths[key], fileName }} showName={false} />}
                  </div>
                  <div style={{ marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={fileName}>{mode === 'scene' ? `escena ${Number(idx) + 1}` : `diálogos ${Number(idx) + 1}`}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Per-panel prompts */}
      {strip.panels.map((panel, i) => {
        let scenePrompt = ''
        let letteringPrompt = ''
        try {
          scenePrompt = generateScenePrompt(panel, chars, strip.generalStyle, bgs, objs, strip.aspectRatio, i, strip, project, sceneLayoutFileNameFor(strip, i))
          letteringPrompt = generateLetteringPrompt(panel, chars, strip.generalStyle, bgs, objs, strip.aspectRatio, i, strip, project, letteringLayoutFileNameFor(strip, i))
        } catch (err) {
          console.error(`Error generando prompt cuadro ${i}:`, err)
          scenePrompt = `Error generando prompt: ${err.message}`
          letteringPrompt = `Error generando prompt: ${err.message}`
        }
        return (
          <div key={panel.id} className="card" style={{ padding: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-2)' }}>cuadro {i + 1}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-3)' }}>escena</span>
              <button
                className="btn btn-ghost btn-sm"
                style={{ fontSize: 11 }}
                onClick={() => copyToClipboard(scenePrompt, `scene-${i}`)}
              >
                {copied === `scene-${i}` ? 'copiado ✓' : 'copiar escena'}
              </button>
            </div>
            <div className="prompt-output">{scenePrompt}</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, marginTop: 12 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-3)' }}>diálogos</span>
              <button
                className="btn btn-ghost btn-sm"
                style={{ fontSize: 11 }}
                onClick={() => copyToClipboard(letteringPrompt, `lettering-${i}`)}
              >
                {copied === `lettering-${i}` ? 'copiado ✓' : 'copiar diálogos'}
              </button>
            </div>
            <div className="prompt-output">{letteringPrompt}</div>
          </div>
        )
      })}
    </div>
  )
}

function ReferenceThumbnail({ reference }) {
  const [src, setSrc] = useState(null)
  useEffect(() => { window.api.references.read(reference.path).then(setSrc) }, [reference.path])

  const handleMouseDown = (e) => {
    e.preventDefault()
    if (window.api?.references?.startDrag) {
      window.api.references.startDrag(reference.path)
    }
  }

  if (!src) return null
  return (
    <img
      src={src}
      alt={reference.entityName}
      onMouseDown={handleMouseDown}
      style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', cursor: 'grab' }}
    />
  )
}
