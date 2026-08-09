import { useEffect, useState } from 'react'
import useBackgroundStore from '../../store/backgroundStore'
import useObjectStore from '../../store/objectStore'
import { generateAllPanelsPrompt, generateScenePrompt, generateLetteringPrompt, usedBalloonEntityIds, sceneLayoutFileNameFor, letteringLayoutFileNameFor } from '../../services/promptGenerator'
import { generateLayoutSVG } from '../../services/layoutSvg'

export default function PromptExporter({ strip, characters, project, balloons }) {
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
    allPrompts = generateAllPanelsPrompt(strip, chars, bgs, objs, project, balloons)
  } catch {
    allPrompts = 'Error generando prompts'
  }

  const generateVectors = async () => {
    setGenerating(true)
    setShowVectors(true)
    for (let i = 0; i < (strip.panels || []).length; i++) {
      try {
        const panel = strip.panels[i]
        const sceneSvg = generateLayoutSVG(panel, chars, bgs, objs, resolvedAspect, 'scene')
        const letteringSvg = generateLayoutSVG(panel, chars, bgs, objs, resolvedAspect, 'lettering')
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
    const refs = []
    const seen = new Set()
    ;(strip.panels || []).forEach(panel => {
      usedBalloonEntityIds(panel).forEach(id => {
        const entity = (balloons || []).find(b => b.id === id)
        if (!entity) return
        ;(entity.referenceImages || []).forEach(r => {
          if (seen.has(r.path || r.fileName)) return
          seen.add(r.path || r.fileName)
          refs.push({ ...r, entityName: entity.name, balloonType: entity.kind })
        })
      })
    })
    return refs
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
          letteringPrompt = generateLetteringPrompt(panel, chars, strip.generalStyle, bgs, objs, strip.aspectRatio, i, strip, project, letteringLayoutFileNameFor(strip, i), balloons)
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
