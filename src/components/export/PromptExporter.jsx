import { useEffect, useState } from 'react'
import useBackgroundStore from '../../store/backgroundStore'
import useObjectStore from '../../store/objectStore'
import useStripStore from '../../store/stripStore'
import usePaletteStore from '../../store/paletteStore'
import { generateAllPanelsPrompt, generateScenePrompt, generateLetteringPrompt, usedBalloonEntityIds, sceneLayoutFileNameFor, letteringLayoutFileNameFor } from '../../services/promptGenerator'
import { generateLayoutSVG } from '../../services/layoutSvg'
import AutoTextarea from '../editor/AutoTextarea'

export default function PromptExporter({ strip, characters, project, balloons }) {
  const backgrounds = useBackgroundStore(s => s.backgrounds)
  const objects = useObjectStore(s => s.objects)
  const palettes = usePaletteStore(s => s.palettes)
  const saveStrip = useStripStore(s => s.save)
  const liveStrip = useStripStore(s => s.strips.find(st => st.id === strip?.id)) || strip
  const [copied, setCopied] = useState(null)
  const [svgPaths, setSvgPaths] = useState({})
  const [generating, setGenerating] = useState(false)
  const [results, setResults] = useState([])
  const [coverIndex, setCoverIndex] = useState(-1)

  const chars = characters || []
  const bgs = backgrounds || []
  const objs = objects || []
  const resolvedPalette = project?.paletteId ? (palettes.find(p => p.id === project.paletteId)?.colors || null) : null

  useEffect(() => {
    setResults(strip?.results || [])
    setCoverIndex(strip?.resultCoverIndex ?? -1)
    setSvgPaths({})
    generateVectors()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strip?.id])

  if (!strip || !strip.panels) return <div style={{ padding: 16 }}>cargando prompts...</div>

  const resolvedAspect = strip.aspectRatio || project?.defaultAspectRatio || 'hd'

  let allPrompts = ''
  try {
    allPrompts = generateAllPanelsPrompt(strip, chars, bgs, objs, project, balloons, resolvedPalette)
  } catch {
    allPrompts = 'Error generando prompts'
  }

  const generateVectors = async () => {
    setGenerating(true)
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
      if (window.api?.clipboard?.write) {
        await window.api.clipboard.write(text)
      } else {
        await navigator.clipboard.writeText(text)
      }
    } catch {
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

  // ---- resultados de generación ----
  const persistResults = (nextResults, nextCover) => {
    setResults(nextResults)
    setCoverIndex(nextCover)
    saveStrip({ ...liveStrip, results: nextResults, resultCoverIndex: nextCover })
  }
  const pasteResult = async () => {
    if ((results || []).length >= 3) return
    if (!window.api?.references?.paste) {
      alert('reiniciá la app para activar "pegar resultado"')
      return
    }
    const baseName = `${(liveStrip?.id || 'strip').slice(0, 8)}-result${(results || []).length + 1}`
    const imported = await window.api.references.paste({ fileName: baseName })
    if (!imported) {
      alert('no hay imagen en el portapapeles: copiá la imagen de la IA (⌘C) y volvé a intentar')
      return
    }
    const next = [...(results || []), { id: crypto.randomUUID(), fileName: imported.fileName, path: imported.path, observations: '', pasted: true }]
    persistResults(next, coverIndex < 0 ? 0 : coverIndex)
  }
  const updateObservation = (id, observations) => {
    const next = (results || []).map(r => r.id === id ? { ...r, observations } : r)
    setResults(next)
    saveStrip({ ...liveStrip, results: next, resultCoverIndex: coverIndex })
  }
  const removeResult = (id) => {
    const next = (results || []).filter(r => r.id !== id)
    let nextCover = coverIndex
    if (next.length === 0) nextCover = -1
    else if (nextCover >= next.length) nextCover = next.length - 1
    persistResults(next, nextCover)
  }
  const selectCover = (idx) => {
    setCoverIndex(idx)
    saveStrip({ ...liveStrip, results: results || [], resultCoverIndex: idx })
  }

  // ---- referencias por panel ----
  const panelSceneRefs = (panel) => {
    const refs = []
    const usedCharIds = new Set((panel.characters || []).map(c => c.characterId))
    const usedObjIds = new Set((panel.objects || []).map(o => o.objectId))
    const bgId = panel.backgroundId
    const add = (list) => list.forEach(e => (e.referenceImages || []).forEach(r => refs.push({ ...r, entityName: e.name })))
    add(chars.filter(c => usedCharIds.has(c.id)))
    add(objs.filter(o => usedObjIds.has(o.id)))
    if (bgId) add(bgs.filter(b => b.id === bgId))
    return refs
  }
  const panelBalloonRefs = (panel) => {
    const refs = []
    const seen = new Set()
    usedBalloonEntityIds(panel, project, balloons).forEach(id => {
      const entity = balloons.find(b => b.id === id)
      if (!entity) return
      ;(entity.referenceImages || []).forEach(r => {
        if (seen.has(r.path || r.fileName)) return
        seen.add(r.path || r.fileName)
        refs.push({ ...r, entityName: entity.name })
      })
    })
    return refs
  }

  const hasLettering = (panel) => {
    if (panel?.narration?.text) return true
    if ((panel?.sfx || []).some(item => item.text)) return true
    if ((panel?.globosX || []).some(g => g.text)) return true
    if ((panel?.characters || []).some(c => c.dialogue || (c.extraDialogues || []).some(e => e.text))) return true
    return false
  }

  const usedFileNames = [...new Set([
    ...strip.panels.flatMap(p => panelSceneRefs(p).map(r => r.fileName)),
    ...strip.panels.flatMap(p => panelBalloonRefs(p).map(r => r.fileName)),
    ...(results || []).map(r => r.fileName),
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
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="btn btn-sm" onClick={() => copyToClipboard(allPrompts, 'all')}>
          {copied === 'all' ? 'copiado ✓' : 'copiar todos'}
        </button>
        <button className="btn btn-sm" onClick={() => exportToFile(allPrompts, `${strip.title || 'viñeta'}-prompts.txt`)}>
          exportar .txt
        </button>
        <button className="btn btn-sm" onClick={generateVectors} disabled={generating}>
          {generating ? 'generando vectores...' : 'regenerar vectores'}
        </button>
      </div>

      {/* Resultados de generación */}
      <div className="card" style={{ padding: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600 }}>resultados de generación (máx. 3)</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-ghost btn-sm" onClick={openUsedFolder} disabled={!usedFileNames.length}>
              abrir carpeta
            </button>
            <button className="btn btn-ghost btn-sm" onClick={pasteResult} disabled={(results || []).length >= 3}>
              + pegar resultado
            </button>
          </div>
        </div>
        {(results || []).length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
            todavía no pegaste resultados: la imagen que generó la IA con estos prompts.
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {(results || []).map((r, idx) => (
              <div key={r.id} style={{ width: 230, border: '1px solid var(--color-border)', borderRadius: 6, padding: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 600 }}>resultado {idx + 1}{r.pasted ? ' ✓ pegada' : ''}</span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      className={`btn btn-sm ${coverIndex === idx ? '' : 'btn-ghost'}`}
                      style={{ fontSize: 10, padding: '2px 6px' }}
                      onClick={() => selectCover(idx)}
                    >
                      {coverIndex === idx ? 'portada ✓' : 'usar como portada'}
                    </button>
                    <button className="btn btn-ghost btn-sm btn-danger" onClick={() => removeResult(r.id)} style={{ fontSize: 10 }}>×</button>
                  </div>
                </div>
                <div style={{ height: 120, border: '1px solid var(--color-border)', borderRadius: 5, padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
                  {window.api?.references?.read && <ReferenceThumbnail reference={{ path: r.path, fileName: r.fileName }} />}
                </div>
                <label className="label" style={{ marginBottom: 2 }}>observaciones</label>
                <AutoTextarea
                  value={r.observations || ''}
                  onChange={e => updateObservation(r.id, e.target.value)}
                  placeholder="qué corregir o tener en cuenta..."
                  minRows={1}
                  maxRows={4}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tarjetones por panel: escena | diálogos */}
      {strip.panels.map((panel, i) => {
        let scenePrompt = ''
        let letteringPrompt = ''
        try {
          scenePrompt = generateScenePrompt(panel, chars, strip.generalStyle, bgs, objs, strip.aspectRatio, i, strip, project, sceneLayoutFileNameFor(strip, i), resolvedPalette)
          letteringPrompt = generateLetteringPrompt(panel, chars, strip.generalStyle, bgs, objs, strip.aspectRatio, i, strip, project, letteringLayoutFileNameFor(strip, i), balloons)
        } catch (err) {
          console.error(`Error generando prompt cuadro ${i}:`, err)
          scenePrompt = `Error generando prompt: ${err.message}`
          letteringPrompt = `Error generando prompt: ${err.message}`
        }
        const scenePath = svgPaths[`${i}:scene`]
        const letteringPath = svgPaths[`${i}:lettering`]
        const sceneRefs = panelSceneRefs(panel)
        const balloonRefsPanel = panelBalloonRefs(panel)
        return (
          <div key={panel.id} className="card" style={{ padding: 12 }}>
            <div style={{ marginBottom: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-2)' }}>cuadro {i + 1}</span>
            </div>
            <div style={{ display: 'flex', gap: 20, alignItems: 'stretch' }}>
              {/* Columna escena */}
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-3)' }}>escena</span>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: 11 }}
                    onClick={() => copyToClipboard(scenePrompt, `scene-${i}`)}
                  >
                    {copied === `scene-${i}` ? 'copiado ✓' : 'copiar escena'}
                  </button>
                </div>
                {/* Visual arriba */}
                {scenePath && (
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 4 }}>layout escena</div>
                    <div style={{ border: '1px solid var(--color-border)', borderRadius: 6, padding: 6, display: 'inline-block', background: 'white', width: 160 }}>
                      {window.api?.references?.read && <ReferenceThumbnail reference={{ path: scenePath, fileName: sceneLayoutFileNameFor(strip, i) }} />}
                    </div>
                  </div>
                )}
                {sceneRefs.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 4 }}>referencias de escena (arrastrar)</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {sceneRefs.map(ref => (
                        <div key={ref.path} style={{ width: 72 }}>
                          <div style={{ height: 64, border: '1px solid var(--color-border)', borderRadius: 5, padding: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {window.api?.references?.read && <ReferenceThumbnail reference={ref} />}
                          </div>
                          <div style={{ fontSize: 9, color: 'var(--color-text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={ref.fileName}>{ref.fileName}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {/* Texto debajo */}
                <div className="prompt-output">{scenePrompt}</div>
              </div>

                {/* Divisor entre columnas */}
                {hasLettering(panel) && <div style={{ width: 1, background: 'var(--color-border)', flexShrink: 0 }} />}

                {/* Columna diálogos */}
                {hasLettering(panel) && (
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-3)' }}>diálogos</span>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ fontSize: 11 }}
                        onClick={() => copyToClipboard(letteringPrompt, `lettering-${i}`)}
                      >
                        {copied === `lettering-${i}` ? 'copiado ✓' : 'copiar diálogos'}
                      </button>
                    </div>
                    {/* Visual arriba */}
                    {(letteringPath || balloonRefsPanel.length > 0) && (
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 4 }}>layout diálogos + ejemplos de globo (arrastrar)</div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                          {letteringPath && (
                            <div style={{ border: '1px solid var(--color-border)', borderRadius: 6, padding: 6, background: 'white', width: 160 }}>
                              {window.api?.references?.read && <ReferenceThumbnail reference={{ path: letteringPath, fileName: letteringLayoutFileNameFor(strip, i) }} />}
                            </div>
                          )}
                          {balloonRefsPanel.map(ref => (
                            <div key={ref.path} style={{ width: 72 }}>
                              <div style={{ height: 64, border: '1px solid var(--color-border)', borderRadius: 5, padding: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {window.api?.references?.read && <ReferenceThumbnail reference={ref} />}
                              </div>
                              <div style={{ fontSize: 9, color: 'var(--color-text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={ref.fileName}>{ref.fileName}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Texto debajo */}
                    <div className="prompt-output">{letteringPrompt}</div>
                  </div>
                )}
            </div>
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
