import { useEffect, useState } from 'react'
import useBackgroundStore from '../../store/backgroundStore'
import useObjectStore from '../../store/objectStore'
import useStripStore from '../../store/stripStore'
import usePaletteStore, { resolvePaletteColors } from '../../store/paletteStore'
import useAuthorStore from '../../store/authorStore'
import useReferenceStore from '../../store/referenceStore'
import useChatStore from '../../store/chatStore'
import { generateAllPanelsPrompt, generateScenePrompt, generateLetteringPrompt, usedBalloonEntityIds, sceneLayoutFileNameFor, letteringLayoutFileNameFor } from '../../services/promptGenerator'
import { generateLayoutSVG } from '../../services/layoutSvg'
import { sendToChat, extractLastImageFromChat } from '../../services/chatAutopaste'

const MAX_RESULTS = 2
import ImagePreview from '../ImagePreview'

export default function PromptExporter({ strip, characters, project, balloons }) {
  const backgrounds = useBackgroundStore(s => s.backgrounds)
  const objects = useObjectStore(s => s.objects)
  const palettes = usePaletteStore(s => s.palettes)
  const authors = useAuthorStore(s => s.authors)
  const references = useReferenceStore(s => s.references)
  const saveStrip = useStripStore(s => s.save)
  const liveStrip = useStripStore(s => s.strips.find(st => st.id === strip?.id)) || strip
  const [copied, setCopied] = useState(null)
  const [svgPaths, setSvgPaths] = useState({})
  const [generating, setGenerating] = useState(false)
  const [results, setResults] = useState([])
  const [coverIndex, setCoverIndex] = useState(-1)
  const [showRefs, setShowRefs] = useState(false)
  const [sending, setSending] = useState({}) // key: `scene-0` / `lettering-0` -> bool
  const chatOpen = useChatStore(s => s.open)

  const chars = characters || []
  const bgs = backgrounds || []
  const objs = objects || []
  const projectRefs = references.filter(r => r.projectId === project?.id)
  const resolvedPalette = resolvePaletteColors(project, palettes)
  const author = project?.authorId ? (authors.find(a => a.id === project.authorId) || null) : null

  const hasLettering = (panel) => {
    if (panel?.narration?.text) return true
    if ((panel?.sfx || []).some(item => item.text)) return true
    if ((panel?.globosX || []).some(g => g.text)) return true
    if ((panel?.characters || []).some(c => c.dialogue || (c.extraDialogues || []).some(e => e.text))) return true
    return false
  }

  const [preview, setPreview] = useState(null)
  const [copiedImage, setCopiedImage] = useState(false)

  // Copia la imagen del resultado al portapapeles (para pegarla donde se quiera).
  const copyResultImage = async (r) => {
    if (!window.api?.references?.read || !window.api?.clipboard?.writeImage) return
    const url = await window.api.references.read(r.path)
    if (!url) return
    const base64 = url.split(',')[1]
    const ok = await window.api.clipboard.writeImage(base64)
    if (ok) {
      setCopiedImage(true)
      setTimeout(() => setCopiedImage(false), 2000)
    }
  }
  // Copia al portapapeles la imagen TILDADA (la que va a preview y export);
  // si ninguna está tildada, copia el primer resultado.
  const copyCoverResult = () => {
    const idx = coverIndex >= 0 ? coverIndex : 0
    const r = (results || [])[idx]
    if (r) copyResultImage(r)
  }

  const openPreview = async (r, idx) => {
    const src = window.api?.references ? await window.api.references.read(r.path) : null
    if (src) setPreview({ src, title: `resultado ${idx + 1}${r.pasted ? ' · pegada' : ''} — ${strip.title || ''}` })
  }

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
    allPrompts = generateAllPanelsPrompt(strip, chars, bgs, objs, project, balloons, resolvedPalette, author)
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

  // --- enviar al chat (autopaste) ---
  const readImageDataUrl = async (filePath) => {
    if (!filePath || !window.api?.references?.read) return null
    try { return await window.api.references.read(filePath) } catch { return null }
  }

  const collectImageDataUrls = async (filePaths) => {
    const out = []
    for (const p of filePaths) {
      const url = await readImageDataUrl(p)
      if (url) out.push({ dataUrl: url, fileName: String(p).split('/').pop() || 'imagen.png' })
    }
    return out
  }
  const dedupPaths = (paths) => [...new Set(paths.filter(Boolean))]

  const handleSendScene = async (idx, promptText, svgPath, refs) => {
    const key = `scene-${idx}`
    if (sending[key]) return
    setSending(s => ({ ...s, [key]: true }))
    try {
      const refPaths = (refs || []).map(r => r.path).filter(Boolean)
      const allPaths = dedupPaths([...refPaths, svgPath])
      const items = await collectImageDataUrls(allPaths)
      console.log('[autopaste scene] paths', allPaths, 'items', items.length, items.map(i=>i.fileName))
      // nonce para evitar dedupe de prompt idéntico en chatgpt
      const uniquePrompt = promptText + `\n\n<!-- doski:${Date.now().toString(36)} -->`
      const res = await sendToChat({ text: uniquePrompt, imageItems: items, newChat: true })
      if (res?.error) {
        console.warn('autopaste scene error', res)
        await copyToClipboard(promptText, key)
        alert(`no se pudo enviar automático (${res.error}): prompt copiado al portapapeles. pegalo manual en el chat.`)
      } else if (items.length && (res?.pasted ?? 0) < items.length) {
        console.warn('autopaste scene: no se pegaron todas las refs', res)
        alert(`texto enviado, pero solo ${res?.pasted ?? 0}/${items.length} imágenes se adjuntaron. revisá el chat: si faltan, arrastralas manual desde "referencias de escena".`)
        setCopied(key + '-sent')
        setTimeout(() => setCopied(null), 2500)
      } else {
        if (res?.duplicateWarning) console.warn('chatgpt duplicate warning', res.duplicateWarning)
        setCopied(key + '-sent')
        setTimeout(() => setCopied(null), 2500)
      }
    } catch (e) {
      console.error('handleSendScene', e)
      await copyToClipboard(promptText, key)
      alert(`no se pudo enviar automático (${e.message}): prompt copiado.`)
    } finally {
      setSending(s => ({ ...s, [key]: false }))
    }
  }

  const handleSendLettering = async (idx, promptText, svgPath, refs) => {
    const key = `lettering-${idx}`
    if (sending[key]) return
    // diálogos requiere imagen de escena aprobada (SCENE LOCK)
    const cover = coverIndex >= 0 ? results[coverIndex] : null
    if (!cover?.path) {
      alert('no hay imagen de escena aprobada: generá la escena, pegá el resultado y tildá (✓) la imagen que va a preview antes de enviar diálogos. se suspende el envío.')
      return
    }
    setSending(s => ({ ...s, [key]: true }))
    try {
      const refPaths = (refs || []).map(r => r.path).filter(Boolean)
      const allPaths = dedupPaths([cover.path, ...refPaths, svgPath])
      const items = await collectImageDataUrls(allPaths)
      console.log('[autopaste lettering] cover', cover.path, 'refs', refPaths, 'svg', svgPath, 'items', items.length, items.map(i=>i.fileName))
      if (!items.length) {
        alert('no se pudo leer la imagen de escena aprobada')
        return
      }
      const uniquePrompt = promptText + `\n\n<!-- doski:${Date.now().toString(36)} -->`
      const res = await sendToChat({ text: uniquePrompt, imageItems: items, newChat: true })
      if (res?.error) {
        console.warn('autopaste lettering error', res)
        await copyToClipboard(promptText, key)
        alert(`no se pudo enviar automático (${res.error}): prompt copiado al portapapeles.`)
      } else if (items.length && (res?.pasted ?? 0) < items.length) {
        console.warn('autopaste lettering: no se pegaron todas las refs', res)
        alert(`texto enviado, pero solo ${res?.pasted ?? 0}/${items.length} imágenes se adjuntaron. si faltan, arrastralas manual.`)
        setCopied(key + '-sent')
        setTimeout(() => setCopied(null), 2500)
      } else {
        if (res?.duplicateWarning) console.warn('chatgpt duplicate warning', res.duplicateWarning)
        setCopied(key + '-sent')
        setTimeout(() => setCopied(null), 2500)
      }
    } catch (e) {
      console.error('handleSendLettering', e)
      await copyToClipboard(promptText, key)
      alert(`no se pudo enviar automático (${e.message}): prompt copiado.`)
    } finally {
      setSending(s => ({ ...s, [key]: false }))
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

  // ---- resultados de generación ----
  const persistResults = (nextResults, nextCover) => {
    setResults(nextResults)
    setCoverIndex(nextCover)
    saveStrip({ ...liveStrip, results: nextResults, resultCoverIndex: nextCover })
  }
  const pasteResult = async () => {
    if ((results || []).length >= MAX_RESULTS) return
    if (!window.api?.references?.paste) {
      alert('reiniciá la app para activar "pegar"')
      return
    }
    const baseName = `${(liveStrip?.id || 'strip').slice(0, 8)}-result${(results || []).length + 1}`
    const imported = await window.api.references.paste({ fileName: baseName })
    if (!imported) {
      alert('no hay imagen en el portapapeles: copiá la imagen con ⌘C / clic derecho → copiar imagen y volvé a intentar')
      return
    }
    const next = [...(results || []), { id: crypto.randomUUID(), fileName: imported.fileName, path: imported.path, observations: '', pasted: true }]
    persistResults(next, next.length - 1)
  }

  const pasteFromChat = async () => {
    if ((results || []).length >= MAX_RESULTS) return
    const baseName = `${(liveStrip?.id || 'strip').slice(0, 8)}-result${(results || []).length + 1}`
    try {
      const b64 = await extractLastImageFromChat()
      if (!b64) {
        alert('no se encontró imagen en el chat: generá la imagen en chatgpt y esperá a que se vea completa antes de pegar')
        return
      }
      if (!window.api?.references?.saveFile) {
        alert('reiniciá la app para activar "pegar desde chat"')
        return
      }
      const fileName = `${baseName}.png`
      const saved = await window.api.references.saveFile({ fileName, data: b64 })
      if (!saved?.path) {
        alert('no se pudo guardar la imagen del chat')
        return
      }
      const next = [...(results || []), { id: crypto.randomUUID(), fileName: saved.fileName || fileName, path: saved.path, observations: '', pasted: true }]
      persistResults(next, next.length - 1)
    } catch (e) {
      console.error('pasteFromChat', e)
      alert(`no se pudo pegar desde el chat: ${e.message}`)
    }
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
  // La ✓ elige qué resultado va a preview y export. Tildar la misma de nuevo la
  // destilda (ninguna): la viñeta no aparece en preview y export, pero sus
  // resultados siguen saliendo en "exportar todas".
  const selectCover = (idx) => {
    const next = coverIndex === idx ? -1 : idx
    setCoverIndex(next)
    saveStrip({ ...liveStrip, results: results || [], resultCoverIndex: next })
  }

  // ---- referencias por panel ----
  const panelSceneRefs = (panel) => {
    const refs = []
    const seen = new Set()
    const usedCharIds = new Set((panel.characters || []).map(c => c.characterId))
    const usedObjIds = new Set((panel.objects || []).map(o => o.objectId))
    const bgId = panel.backgroundId
    const add = (list) => list.forEach(e => (e.referenceImages || []).forEach(r => {
      const key = r.path || r.fileName
      if (seen.has(key)) return
      seen.add(key)
      refs.push({ ...r, entityName: e.name })
    }))
    add(chars.filter(c => usedCharIds.has(c.id)))
    add(objs.filter(o => usedObjIds.has(o.id)))
    if (bgId) add(bgs.filter(b => b.id === bgId))
    if (panel.signature && author?.signatureImage?.[0]) {
      const r = author.signatureImage[0]
      const key = r.path || r.fileName
      if (!seen.has(key)) {
        seen.add(key)
        refs.push({ ...r, entityName: 'firma' })
      }
    }
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginRight: chatOpen ? 520 : 0 }}>
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
        <button className="btn btn-sm" onClick={() => setShowRefs(true)} title="sumar imágenes de referencia al prompt (arrastralas al chat)">
          sumar referencia
        </button>
      </div>

      {/* Resultados: imágenes solas sobre fondo blanco */}
      <div style={{
        background: '#fff',
        border: '1px solid var(--color-border)',
        borderRadius: 8,
        padding: 12,
        display: 'inline-block',
        maxWidth: '100%',
        alignSelf: 'flex-start',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          {(results || []).length > 0 && (
            <>
              <button className="btn btn-sm" onClick={openUsedFolder} disabled={!usedFileNames.length}>
                abrir carpeta
              </button>
              <button className="btn btn-sm" onClick={copyCoverResult} title="copiar la imagen tildada (la que va a preview y export)">
                {copiedImage ? 'copiado' : 'copiar'}
              </button>
            </>
          )}
          <button className="btn btn-sm" onClick={pasteResult} disabled={(results || []).length >= MAX_RESULTS} title="pega la imagen que copiaste con ⌘C / clic derecho → copiar imagen">
            + pegar común
          </button>
          <button className="btn btn-sm" onClick={pasteFromChat} disabled={(results || []).length >= MAX_RESULTS} title="intenta copiar la última imagen generada que esté visible en el chat activo">
            + pegar desde chat
          </button>
        </div>
        {(results || []).length >= MAX_RESULTS && (
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 10, border: '1px dashed var(--color-border)', borderRadius: 6, padding: '4px 10px', display: 'inline-block' }}>
            dos img max
          </div>
        )}
        {(results || []).length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
            todavía no pegaste resultados: usá "+ pegar común" si copiaste la imagen (⌘C), o "+ pegar desde chat" para traer la última generada del chat activo.
          </div>
        ) : (
          <>
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            {(results || []).map((r, idx) => (
              <div key={r.id} style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
                <div
                  style={{ position: 'relative', width: 280, height: 250, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-in' }}
                  onClick={() => openPreview(r, idx)}
                  title="ver en grande"
                >
                  {window.api?.references?.read && <ReferenceThumbnail reference={{ path: r.path, fileName: r.fileName }} dragDisabled />}
                  <span
                    onClick={(e) => { e.stopPropagation(); removeResult(r.id) }}
                    title="eliminar"
                    style={{ position: 'absolute', top: 0, right: 4, fontSize: 14, color: 'var(--color-text-muted)', cursor: 'pointer', userSelect: 'none', lineHeight: 1 }}
                  >
                    ×
                  </span>
                  <span
                    onClick={(e) => { e.stopPropagation(); selectCover(idx) }}
                    title={coverIndex === idx ? 'destildar: no va a preview y export' : 'elegir para preview y export'}
                    style={{
                      position: 'absolute',
                      bottom: 6,
                      left: 6,
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      border: '1.5px solid var(--color-text-muted)',
                      background: coverIndex === idx ? 'var(--color-text)' : 'transparent',
                      color: coverIndex === idx ? '#fff' : 'transparent',
                      fontSize: 12,
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      userSelect: 'none',
                      lineHeight: 1,
                      boxSizing: 'border-box',
                    }}
                  >
                    ✓
                  </span>
                </div>
                <textarea
                  value={r.observations || ''}
                  onChange={e => updateObservation(r.id, e.target.value)}
                  placeholder="nota"
                  title="nota sobre este resultado"
                  style={{
                    width: 280,
                    height: 250,
                    resize: 'none',
                    border: '1px solid var(--color-border)',
                    borderRadius: 6,
                    background: '#fff',
                    color: 'var(--color-text-2)',
                    fontSize: 12,
                    lineHeight: 1.5,
                    padding: '6px 8px',
                    outline: 'none',
                    fontFamily: 'inherit',
                  }}
                />
              </div>
            ))}
          </div>
          {(results || []).length > 1 && (
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 10 }}>
              la imagen con ✓ es la que se muestra en preview y export, y la que copia el botón copiar. tildá y destildá para elegir; destildada, la viñeta no aparece en preview y export pero sale en "exportar todas".
            </div>
          )}
          {coverIndex === -1 && (results || []).length > 0 && (
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 10 }}>
              sin imagen elegida: esta viñeta no aparece en preview y export (queda como traza), pero sus resultados se exportan con "exportar todas".
            </div>
          )}
          </>
        )}
      </div>

      {/* Tarjetones por panel: escena | diálogos */}
      {strip.panels.map((panel, i) => {
        let scenePrompt = ''
        let letteringPrompt = ''
        try {
          scenePrompt = generateScenePrompt(panel, chars, strip.generalStyle, bgs, objs, strip.aspectRatio, i, strip, project, sceneLayoutFileNameFor(strip, i), resolvedPalette, author)
          letteringPrompt = generateLetteringPrompt(panel, chars, strip.generalStyle, bgs, objs, strip.aspectRatio, i, strip, project, letteringLayoutFileNameFor(strip, i), balloons, resolvedPalette)
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
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-3)' }}>escena</span>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ fontSize: 11 }}
                      onClick={() => copyToClipboard(scenePrompt, `scene-${i}`)}
                    >
                      {copied === `scene-${i}` ? 'copiado ✓' : 'copiar escena'}
                    </button>
                    <button
                      className="btn btn-sm"
                      style={{ fontSize: 11 }}
                      onClick={() => handleSendScene(i, scenePrompt, scenePath, sceneRefs)}
                      disabled={!!sending[`scene-${i}`]}
                      title={sceneRefs.length || scenePath ? `envía ${sceneRefs.length + (scenePath ? 1 : 0)} imágenes + texto al chat` : 'envía el prompt al chat'}
                    >
                      {sending[`scene-${i}`] ? 'enviando…' : copied === `scene-${i}-sent` ? 'enviado ✓' : 'enviar al chat'}
                    </button>
                  </div>
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
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-3)' }}>diálogos</span>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ fontSize: 11 }}
                          onClick={() => copyToClipboard(letteringPrompt, `lettering-${i}`)}
                        >
                          {copied === `lettering-${i}` ? 'copiado ✓' : 'copiar diálogos'}
                        </button>
                        <button
                          className="btn btn-sm"
                          style={{ fontSize: 11 }}
                          onClick={() => handleSendLettering(i, letteringPrompt, letteringPath, balloonRefsPanel)}
                          disabled={!!sending[`lettering-${i}`]}
                          title={balloonRefsPanel.length || letteringPath ? `envía ${balloonRefsPanel.length + (letteringPath ? 1 : 0)} imágenes + texto al chat` : 'envía el prompt al chat'}
                        >
                          {sending[`lettering-${i}`] ? 'enviando…' : copied === `lettering-${i}-sent` ? 'enviado ✓' : 'enviar al chat'}
                        </button>
                      </div>
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
      {preview && (
        <ImagePreview src={preview.src} title={preview.title} onClose={() => setPreview(null)} />
      )}
      {showRefs && (
        <div style={{ position: 'fixed', inset: 0, background: '#fff', zIndex: 10000, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', borderBottom: '1px solid var(--color-border-muted)', flexShrink: 0 }}>
            <button className="back-arrow" onClick={() => setShowRefs(false)} title="volver (Esc)">←</button>
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text)' }}>referencias</span>
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>arrastralas al chat para sumarlas al prompt</span>
            <div style={{ flex: 1 }} />
            <button className="btn btn-sm" onClick={() => setShowRefs(false)}>cerrar</button>
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: 24, display: 'flex', flexWrap: 'wrap', gap: 20, alignContent: 'flex-start' }}>
            {projectRefs.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--color-text-muted)', padding: 40 }}>
                todavía no cargaste referencias en este proyecto.
              </div>
            ) : projectRefs.map(ref => {
              const imgs = (ref.referenceImages || []).filter(i => i.path)
              return (
                <div key={ref.id} style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 300 }}>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{ref.name}</div>
                  {imgs.length === 0 ? (
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)', border: '1px dashed var(--color-border)', borderRadius: 6, padding: '20px 8px', textAlign: 'center' }}>
                      sin imágenes
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {imgs.map(img => (
                        <div
                          key={img.path}
                          title="arrastrala al chat"
                          style={{ border: '1px solid var(--color-border)', borderRadius: 6, padding: 4, background: 'white', width: 140, height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          {window.api?.references?.read && <ReferenceThumbnail reference={img} />}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function ReferenceThumbnail({ reference, dragDisabled }) {
  const [src, setSrc] = useState(null)
  useEffect(() => { window.api.references.read(reference.path).then(setSrc) }, [reference.path])

  const handleMouseDown = (e) => {
    if (dragDisabled) return
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
      draggable={!dragDisabled}
      onMouseDown={handleMouseDown}
      style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', cursor: dragDisabled ? 'zoom-in' : 'grab' }}
    />
  )
}
