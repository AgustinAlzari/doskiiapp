import { useEffect, useState } from 'react'
import useBackgroundStore from '../../store/backgroundStore'
import useObjectStore from '../../store/objectStore'
import { generatePanelPrompt, generateAllPanelsPrompt } from '../../services/promptGenerator'
import { ASPECT_RATIOS } from '../../data/actionPresets'

function generateCanvasSVG(panel, characters, backgrounds, objects, stripAspectRatio) {
  const ar = ASPECT_RATIOS.find(a => a.id === stripAspectRatio)
  const ratioParts = ar ? ar.ratio.split(':').map(Number) : [16, 9]
  const svgW = 400
  const svgH = Math.round(svgW * (ratioParts[1] / ratioParts[0]))

  const rects = []

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

  if (panel.narration && panel.narration.text) {
    const n = panel.narration
    rects.push({ x: n.x * svgW, y: n.y * svgH, w: n.width * svgW, h: n.height * svgH, stroke: '#007aff', fill: 'none', dash: n.framed ? 'none' : '4 3', label: 'narración' })
  }

  ;(panel.sfx || []).forEach((s, i) => {
    if (s.text) rects.push({ x: s.x * svgW, y: s.y * svgH, w: s.width * svgW, h: s.height * svgH, stroke: '#e67e22', fill: 'none', label: s.text })
  })

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgW} ${svgH}" width="${svgW}" height="${svgH}">`
  svg += `<rect x="0" y="0" width="${svgW}" height="${svgH}" fill="white" stroke="#ccc" stroke-width="1"/>`

  rects.forEach(r => {
    const dash = r.dash ? ` stroke-dasharray="${r.dash}"` : ''
    svg += `<rect x="${Math.round(r.x)}" y="${Math.round(r.y)}" width="${Math.round(r.w)}" height="${Math.round(r.h)}" fill="${r.fill}" stroke="${r.stroke}" stroke-width="1.5"${dash}/>`
    const labelX = Math.round(r.x + r.w / 2)
    const labelY = Math.round(r.y + r.h / 2)
    svg += `<text x="${labelX}" y="${labelY}" text-anchor="middle" dominant-baseline="central" font-family="monospace" font-size="10" fill="${r.stroke}">${r.label}</text>`
  })

  svg += '</svg>'
  return svg
}

export default function PromptExporter({ strip, characters }) {
  const backgrounds = useBackgroundStore(s => s.backgrounds)
  const objects = useObjectStore(s => s.objects)
  const [copied, setCopied] = useState(null)
  const [layoutSVGs, setLayoutSVGs] = useState({})
  const [showVectors, setShowVectors] = useState(false)
  const [error, setError] = useState(null)

  const generateVectors = () => {
    try {
      const svgs = {}
      for (let i = 0; i < (strip?.panels || []).length; i++) {
        const panel = strip.panels[i]
        try {
          const svg = generateCanvasSVG(panel, characters || [], backgrounds || [], objects || [], strip.aspectRatio)
          svgs[i] = svg
        } catch (err) {
          console.error(`Error generating SVG for panel ${i}:`, err)
        }
      }
      setLayoutSVGs(svgs)
      setShowVectors(true)
    } catch (err) {
      console.error('Error generating layout SVGs:', err)
    }
  }

  if (!strip || !strip.panels) return <div style={{ padding: 16 }}>cargando prompts...</div>

  let allPrompts = ''
  try {
    allPrompts = generateAllPanelsPrompt(strip, characters || [], backgrounds || [], objects || [])
  } catch (err) {
    setError(err.message)
  }

  const copyToClipboard = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(label)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      // Fallback
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopied(label)
      setTimeout(() => setCopied(null), 2000)
    }
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

  const references = [
    ...characters.flatMap(item => (item.referenceImages || []).map(image => ({ ...image, entityName: item.name }))),
    ...backgrounds.flatMap(item => (item.referenceImages || []).map(image => ({ ...image, entityName: item.name }))),
    ...objects.flatMap(item => (item.referenceImages || []).map(image => ({ ...image, entityName: item.name }))),
  ]

  const usedIds = new Set([
    ...strip.panels.flatMap(p => (p.characters || []).map(c => c.characterId)),
    ...strip.panels.flatMap(p => (p.objects || []).map(o => o.objectId)),
    ...strip.panels.filter(p => p.backgroundId).map(p => p.backgroundId),
  ])
  const usedReferences = references.filter(ref => {
    const entity = [...characters, ...backgrounds, ...objects].find(e => e.name === ref.entityName)
    return entity && usedIds.has(entity.id)
  })

  const panelReferences = panel => {
    const ids = new Set([
      ...(panel.characters || []).map(item => item.characterId),
      ...(panel.objects || []).map(item => item.objectId),
      ...(panel.backgroundId ? [panel.backgroundId] : []),
    ])
    return references.filter(reference => {
      const entity = [...characters, ...backgrounds, ...objects].find(item => item.name === reference.entityName)
      return entity && ids.has(entity.id)
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {error && (
        <div className="card" style={{ padding: 12, borderColor: '#ff3b30', color: '#ff3b30' }}>
          Error: {error}
        </div>
      )}
      {/* Export all */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-sm" onClick={() => copyToClipboard(allPrompts, 'all')}>
          {copied === 'all' ? 'copiado ✓' : 'copiar todos'}
        </button>
        <button className="btn btn-sm" onClick={() => exportToFile(allPrompts, `${strip.title || 'tira'}-prompts.txt`)}>
          exportar .txt
        </button>
      </div>

      {usedReferences.length > 0 && (
        <div className="card" style={{ padding: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600 }}>referencias para arrastrar a la IA</span>
            <button className="btn btn-sm" onClick={generateVectors}>
              {showVectors ? 'vectores ocultos' : 'generar vectores'}
            </button>
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
          </div>
        </div>
      )}

      {/* Per-panel prompts */}
      {strip.panels.map((panel, i) => {
        let prompt = ''
        try {
          prompt = generatePanelPrompt(panel, characters, strip.generalStyle, backgrounds, objects, strip.aspectRatio)
        } catch (err) {
          prompt = `Error generando prompt: ${err.message}`
        }
        return (
          <div key={panel.id} className="card" style={{ padding: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-2)' }}>cuadro {i + 1}</span>
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: 11 }}
                  onClick={() => copyToClipboard(prompt, `panel-${i}`)}
                >
                  {copied === `panel-${i}` ? 'copiado ✓' : 'copiar'}
                </button>
              </div>
            </div>
            <div className="prompt-output">{prompt}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
              {showVectors && layoutSVGs[i] && (
                <div style={{ width: 100, fontSize: 10, color: 'var(--color-text-muted)' }}>
                  <div style={{ height: 78, border: '1px solid var(--color-border)', borderRadius: 5, padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'white' }}>
                    <div dangerouslySetInnerHTML={{ __html: layoutSVGs[i] }} style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }} />
                  </div>
                  <div style={{ marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>layout-{i + 1}.svg</div>
                </div>
              )}
              {panelReferences(panel).map(reference => (
                <ReferenceThumbnail key={reference.path} reference={reference} showName />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ReferenceThumbnail({ reference, showName }) {
  const [src, setSrc] = useState(null)
  useEffect(() => { window.api.references.read(reference.path).then(setSrc) }, [reference.path])
  const handleDragStart = event => {
    event.dataTransfer.effectAllowed = 'copy'
    event.dataTransfer.setData('text/uri-list', `file://${reference.path}`)
    event.dataTransfer.setData('DownloadURL', `image/png:${reference.fileName}:file://${reference.path}`)
  }
  if (!src) return null
  return (
    <div style={{ width: 92, fontSize: 10, color: 'var(--color-text-muted)' }}>
      <div style={{ height: 72, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <img src={src} alt={reference.entityName} draggable onDragStart={handleDragStart} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', cursor: 'grab' }} />
      </div>
      {showName && <div style={{ marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={reference.fileName}>{reference.fileName}</div>}
    </div>
  )
}
