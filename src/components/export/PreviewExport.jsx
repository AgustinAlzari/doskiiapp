import { useEffect, useMemo, useRef, useState } from 'react'
import useStripStore from '../../store/stripStore'
import useProjectStore from '../../store/projectStore'
import useAuthorStore from '../../store/authorStore'
import useTiraStore from '../../store/tiraStore'
import usePreviewStore from '../../store/previewStore'
import { exportCleanImage, exportCleanImages, resolveAuthor, slugify, FORMAT_EXT } from '../../services/imageExport'
import ImagePreview from '../ImagePreview'
import ChatLayout from '../chat/ChatLayout'
import { coverOf } from '../../utils/stripCover'
import TiraSelect from './TiraSelect'

// PNG es lossless; JPEG/WebP exportan con el máximo factor de calidad.
const FORMATS = [
  { id: 'png', label: 'PNG', quality: undefined },
  { id: 'jpeg', label: 'JPEG', quality: 1 },
  { id: 'webp', label: 'WebP', quality: 1 },
]

const GENERAL = '__general__'
const keyOf = (stripId, resultId) => `${stripId}:${resultId}`

// Galería flotante de imágenes: muestra la unión de las tiras seleccionadas en
// el desplegable de arriba (general + una o varias tiras, para ver
// continuidades). Debajo de cada viñeta hay un desplegable para asignarle una
// tira (ir a una tira, o volver a general).
export default function PreviewExport({ project, strips, characters, backgrounds, objects, focusStripId, onGoToStrips }) {
  const saveStrip = useStripStore(s => s.save)
  const saveProject = useProjectStore(s => s.save)
  const authors = useAuthorStore(s => s.authors)
  const author = useMemo(() => resolveAuthor(project, authors), [project, authors])

  const tiras = useTiraStore(s => s.tiras)
  const saveTira = useTiraStore(s => s.save)
  const reorderTira = useTiraStore(s => s.reorder)

  const scopedTiras = tiras.filter(t => t.projectId === project?.id)

  // Tiras seleccionadas que se muestran en el mosaico (general = viñetas sueltas).
  // No fuerza "general" por defecto: arranca con la última selección recordada
  // para este proyecto (en la sesión). Si no hay nada recordado, cae en la
  // primera tira con viñetas; solo si no hay ninguna, muestra "general".
  const initialSelection = (() => {
    const projId = project?.id
    const stored = projId ? usePreviewStore.getState().getSelection(projId) : null
    const inTiraAll = new Set(scopedTiras.flatMap(t => t.stripIds || []))
    const gc = (strips || []).filter(s => s.projectId === projId && !inTiraAll.has(s.id)).length
    const valid = new Set([...scopedTiras.map(t => t.id), ...(gc > 0 ? [GENERAL] : [])])
    if (stored && stored.length && stored.every(id => valid.has(id))) return stored
    const first = scopedTiras.find(t => (t.stripIds || []).length > 0)
    if (first) return [first.id]
    return gc > 0 ? [GENERAL] : []
  })()
  const [selectedTiras, setSelectedTiras] = useState(initialSelection)

  const stripsState = useStripStore(s => s.strips)
  const liveStrips = useMemo(
    () => (strips || []).map(s => stripsState.find(x => x.id === s.id) || s),
    [strips, stripsState]
  )

  // Qué tira contiene a cada viñeta (general = no está en ninguna).
  const tiraOfStrip = useMemo(() => {
    const map = {}
    for (const t of scopedTiras) {
      for (const id of (t.stripIds || [])) {
        if (!map[id]) map[id] = t.id
      }
    }
    return map
  }, [scopedTiras])

  const selectedSet = useMemo(() => new Set(selectedTiras), [selectedTiras])

  // Recuerda la selección de tiras para este proyecto (sesión) para restaurarla
  // al volver a preview desde otra pantalla.
  useEffect(() => {
    if (project?.id) usePreviewStore.getState().setSelection(project.id, selectedTiras)
  }, [selectedTiras, project?.id])

  // Tiras seleccionadas que están vacías: se ven como tarjeta en el mosaico.
  const emptySelectedTiras = useMemo(
    () => scopedTiras.filter(t => selectedSet.has(t.id) && (t.stripIds || []).length === 0),
    [scopedTiras, selectedSet]
  )

  // Viñetas visibles: unión de las tiras seleccionadas (general + varias tiras),
  // heredando el orden actual: las tiras en su propio orden (position), cada una
  // con sus viñetas en el orden de stripIds, y al final las viñetas sueltas
  // (general) en el orden de la lista de viñetas.
  const visibleStrips = useMemo(() => {
    const out = []
    const seen = new Set()
    for (const t of scopedTiras) {
      if (!selectedSet.has(t.id)) continue
      for (const id of (t.stripIds || [])) {
        const s = liveStrips.find(x => x.id === id)
        if (s && !seen.has(s.id)) { out.push(s); seen.add(s.id) }
      }
    }
    if (selectedSet.has(GENERAL)) {
      for (const s of liveStrips) {
        const inTira = tiraOfStrip[s.id]
        if (!inTira && !seen.has(s.id)) { out.push(s); seen.add(s.id) }
      }
    }
    return out
  }, [liveStrips, scopedTiras, tiraOfStrip, selectedSet])

  const defaultItems = useMemo(
    () => visibleStrips.flatMap(s => {
      const results = s.results || []
      if (results.length === 0) return []
      const cover = coverOf(s)
      // Sin portada (destildada): no va al preview/export, pero sus resultados
      // igual se exportan en "exportar todas" (que usa allItems).
      if (!cover) {
        return [{
          key: keyOf(s.id, 'none'),
          stripId: s.id,
          stripTitle: s.title || 'sin título',
          none: true,
        }]
      }
      const idx = results.indexOf(cover)
      return [{
        key: keyOf(s.id, cover.id),
        stripId: s.id,
        stripTitle: s.title || 'sin título',
        resultId: cover.id,
        resultIdx: idx,
        path: cover.path,
        pasted: cover.pasted,
      }]
    }),
    [visibleStrips]
  )

  // Aplica el orden guardado (galleryOrder) y agrega al final lo que no está.
  const items = useMemo(() => {
    const present = new Set(defaultItems.map(it => it.key))
    const keys = (project?.galleryOrder || []).filter(k => present.has(k))
    const byKey = {}
    defaultItems.forEach(it => { byKey[it.key] = it })
    const rest = defaultItems.filter(it => !keys.includes(it.key))
    return [...keys.map(k => byKey[k]), ...rest]
  }, [defaultItems, project?.galleryOrder])

  // Todos los resultados, en el orden del mosaico (items = portadas + galleryOrder),
  // expandiendo cada viñeta en sus resultados. Es el orden que usan "exportar
  // todas" y la galería del preview.
  const allItems = useMemo(() => {
    const orderIndex = new Map(items.map((it, i) => [it.stripId, i]))
    const list = visibleStrips.flatMap(s =>
      (s.results || []).map((r, idx) => ({
        key: keyOf(s.id, r.id),
        stripId: s.id,
        stripTitle: s.title || 'sin título',
        resultId: r.id,
        resultIdx: idx,
        path: r.path,
        pasted: r.pasted,
      }))
    )
    return list.sort((a, b) => {
      const ia = orderIndex.get(a.stripId)
      const ib = orderIndex.get(b.stripId)
      if (ia == null && ib == null) return 0
      if (ia == null) return 1
      if (ib == null) return -1
      return ia - ib
    })
  }, [visibleStrips, items])

  // Carga las fuentes (data URL) de cada imagen del mosaico (batch).
  const [srcs, setSrcs] = useState({})
  useEffect(() => {
    let active = true
    const load = async () => {
      const paths = allItems.map(it => it.path).filter(Boolean)
      const uniq = [...new Set(paths)]
      let map = {}
      if (uniq.length && window.api?.references) {
        try {
          if (window.api.references.readMany) map = await window.api.references.readMany(uniq)
          else {
            const results = await Promise.all(uniq.map(async p => [p, await window.api.references.read(p)]))
            map = Object.fromEntries(results.filter(([, v]) => v))
          }
        } catch {}
      }
      if (!active) return
      const next = {}
      for (const it of allItems) {
        if (it.path && map[it.path]) next[it.key] = map[it.path]
      }
      setSrcs(next)
    }
    load()
    return () => { active = false }
  }, [allItems])

  const [previewIdx, setPreviewIdx] = useState(null)
  const [format, setFormat] = useState('png')
  const [exportingAll, setExportingAll] = useState(false)
  const [copiedImg, setCopiedImg] = useState(false)
  const [tileScale, setTileScale] = useState(1)
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState(new Set())

  // Reordenar el mosaico arrastrando: el orden queda guardado en project.galleryOrder.
  const [dragIdx, setDragIdx] = useState(null)
  const [insertIdx, setInsertIdx] = useState(null)
  const dragOriginRef = useRef(null)

  const persistOrder = (ordered) => {
    const galleryOrder = ordered.map(it => it.key)
    saveProject({ ...project, galleryOrder })
  }

  const onDragStart = (e, idx) => {
    // Si el arrastre empieza sobre un control (select de tira), cancelarlo para
    // que el clic del desplegable funcione aunque haya algo de movimiento.
    if (dragOriginRef.current?.closest?.('select, button, [data-no-drag]')) {
      e.preventDefault()
      return
    }
    if (selectMode) return
    setDragIdx(idx)
    setInsertIdx(null)
    e.dataTransfer.effectAllowed = 'move'
  }
  const onDragOver = (e, idx) => {
    if (dragIdx == null) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const rect = e.currentTarget.getBoundingClientRect()
    const before = e.clientX < rect.left + rect.width / 2
    const next = before ? idx : idx + 1
    if (next !== insertIdx) setInsertIdx(next)
  }
  const onDrop = (e, idx) => {
    e.preventDefault()
    if (dragIdx != null) {
      let target = insertIdx
      if (target == null) {
        const rect = e.currentTarget.getBoundingClientRect()
        target = e.clientX < rect.left + rect.width / 2 ? idx : idx + 1
      }
      const next = [...items]
      const [moved] = next.splice(dragIdx, 1)
      let at = target > dragIdx ? target - 1 : target
      at = Math.max(0, Math.min(next.length, at))
      next.splice(at, 0, moved)
      persistOrder(next)
    }
    setDragIdx(null)
    setInsertIdx(null)
  }
  const onDragEnd = () => { setDragIdx(null); setInsertIdx(null) }

  // Asigna una viñeta a una tira (o la devuelve a general). Solo vive en una
  // tira a la vez: sale de la actual antes de entrar a la elegida.
  const assignStripTira = (stripId, tiraId) => {
    const current = tiraOfStrip[stripId]
    if (current) {
      const t = scopedTiras.find(x => x.id === current)
      if (t) saveTira({ ...t, stripIds: (t.stripIds || []).filter(id => id !== stripId) })
    }
    if (tiraId !== GENERAL) {
      const t = scopedTiras.find(x => x.id === tiraId)
      if (t && !(t.stripIds || []).includes(stripId)) {
        saveTira({ ...t, stripIds: [...(t.stripIds || []), stripId] })
      }
    }
  }

  const toggleSelect = (key) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // Clic afuera deselecciona (no solo con "listo").
  useEffect(() => {
    if (!selectMode) return
    const onMouseDown = (e) => {
      if (e.target.closest('[data-no-deselect]')) return
      setSelected(new Set())
    }
    window.addEventListener('mousedown', onMouseDown)
    return () => window.removeEventListener('mousedown', onMouseDown)
  }, [selectMode])

  const exportItem = async (it) => {
    const f = FORMATS.find(x => x.id === format)
    const defaultName = `${slugify(it.stripTitle)}-result${it.resultIdx + 1}.${FORMAT_EXT[format]}`
    return exportCleanImage({
      sourcePath: it.path,
      title: it.stripTitle,
      author,
      format,
      quality: f?.quality,
      defaultName,
    })
  }

  // Copia al portapapeles la imagen del preview (el tile es la portada tildada
  // de la viñeta, o el resultado elegido al abrir el preview).
  const copyPreviewImage = async (it) => {
    if (!it?.path || !window.api?.references?.read || !window.api?.clipboard?.writeImage) return
    try {
      const url = await window.api.references.read(it.path)
      if (!url) return
      const ok = await window.api.clipboard.writeImage(url.split(',')[1])
      if (ok) {
        setCopiedImg(true)
        setTimeout(() => setCopiedImg(false), 2000)
      }
    } catch (e) {
      console.error('copiar imagen falló:', e)
    }
  }

  const batchItems = (list) => {
    const f = FORMATS.find(x => x.id === format)
    const pad = String(list.length).length
    return {
      items: list.map((it, i) => ({
        sourcePath: it.path,
        title: it.stripTitle,
        fileName: `${String(i + 1).padStart(pad, '0')}-${slugify(it.stripTitle)}.${FORMAT_EXT[format]}`,
      })),
      quality: f?.quality,
    }
  }

  const exportAll = async () => {
    setExportingAll(true)
    try {
      const { items, quality } = batchItems(allItems.filter(it => it.path))
      await exportCleanImages({ items, author, format, quality })
    } catch (e) {
      console.error('export todas falló:', e)
    }
    setExportingAll(false)
  }

  const exportSelected = async () => {
    setExportingAll(true)
    try {
      const { items: batch, quality } = batchItems(items.filter(it => selected.has(it.key) && it.path))
      await exportCleanImages({ items: batch, author, format, quality })
    } catch (e) {
      console.error('export seleccionadas falló:', e)
    }
    setExportingAll(false)
  }

  const toggleCover = (it) => {
    const strip = liveStrips.find(s => s.id === it.stripId)
    if (!strip) return
    const results = strip.results || []
    const rIdx = results.findIndex(r => r.id === it.resultId)
    if (rIdx < 0) return
    const current = strip.resultCoverIndex ?? -1
    saveStrip({ ...strip, resultCoverIndex: current === rIdx ? -1 : rIdx })
  }

  const isCover = (it) => {
    const strip = liveStrips.find(s => s.id === it.stripId)
    if (!strip) return false
    const results = strip.results || []
    const rIdx = results.findIndex(r => r.id === it.resultId)
    return (strip.resultCoverIndex ?? -1) === rIdx
  }

  const openPreview = (key) => {
    const i = allItems.findIndex(it => it.key === key)
    if (i >= 0) setPreviewIdx(i)
  }

  // Para tiles normales abre el preview.
  const openItem = (it) => {
    openPreview(it.key)
  }

  const previewItem = allItems[previewIdx]
  const previewGallery = allItems
    .filter(it => srcs[it.key])
    .map(it => ({ src: srcs[it.key], title: `${it.stripTitle} · resultado ${it.resultIdx + 1}` }))

  return (
    <ChatLayout>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Encabezado + slider: fijos al scrollear (fondo blanco desde arriba, esconde lo que pasa debajo) */}
      <div style={{ position: 'sticky', top: 0, zIndex: 500, background: 'var(--color-bg)', paddingBottom: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Encabezado */}
      <div className="section-header" style={{ flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 0, justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, minWidth: 220, flex: 1 }}>
          <h1 className="ui-h1" style={{ marginBottom: 0, lineHeight: 1 }}>preview y export</h1>
          {project?.name && (
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', paddingBottom: 2 }}>{project.name}</div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, flexShrink: 0 }} data-no-deselect="1">
          <TiraSelect
            tiras={scopedTiras}
            strips={liveStrips}
            value={selectedTiras}
            onChange={setSelectedTiras}
            onReorder={(orderedIds) => {
              reorderTira(project?.id, orderedIds)
              // El orden de tiras del menú manda sobre el orden fino guardado
              // (galleryOrder): se limpia para que la galería refleje el nuevo
              // orden de tiras en vez de quedar clavada al orden viejo.
              saveProject({ ...project, galleryOrder: [] })
            }}
          />
          <span style={{ fontSize: 12, color: 'var(--color-text-muted)', paddingBottom: 2 }}>{allItems.length} {allItems.length === 1 ? 'resultado' : 'resultados'}</span>
          <select className="input" style={{ width: 'auto', fontSize: 12, cursor: 'pointer' }} value={format} onChange={e => setFormat(e.target.value)} title="PNG = lossless (máxima calidad)">
            {FORMATS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
          <button
            className={`btn btn-sm ${selectMode ? '' : 'btn-ghost'}`}
            onClick={() => setSelectMode(v => !v)}
            disabled={exportingAll}
            title={selectMode ? 'salir del modo selección' : 'seleccionar imágenes para exportar'}
          >
            {selectMode ? 'listo' : 'seleccionar'}
          </button>
          {selectMode ? (
            <button className="btn btn-primary btn-sm" onClick={exportSelected} disabled={exportingAll || selected.size === 0}>
              {exportingAll ? 'exportando...' : `exportar seleccionadas (${selected.size})`}
            </button>
          ) : (
            <button className="btn btn-sm" onClick={exportAll} disabled={exportingAll || allItems.length === 0}>
              {exportingAll ? 'exportando...' : 'exportar todas'}
            </button>
          )}
        </div>
      </div>

      {/* Control sutil del tamaño del mosaico */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '2px 0', gap: 8 }}>
        <input
          type="range"
          className="size-slider"
          min="0.4"
          max="1.8"
          step="0.05"
          value={tileScale}
          onChange={e => setTileScale(Number(e.target.value))}
          title="tamaño de las imágenes del mosaico"
        />
        <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>arrastrá las imágenes para reordenar (se guarda el orden)</span>
      </div>
      </div>

      {/* Galería flotante de imágenes */}
      {items.length === 0 && emptySelectedTiras.length === 0 ? (
        <div className="card" style={{ padding: 16, fontSize: 13, color: 'var(--color-text-muted)' }}>
          {visibleStrips.length === 0
            ? 'no hay viñetas en las tiras seleccionadas. elegí una tira en el desplegable de arriba.'
            : 'este proyecto no tiene resultados todavía. pegá la imagen que generó la IA en la vista de prompts de una viñeta.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'flex-start' }}>
          {emptySelectedTiras.map(t => (
            <div
              key={t.id}
              style={{
                width: 180,
                height: 240,
                border: '2px dashed var(--color-border-muted)',
                borderRadius: 8,
                background: 'rgba(0,0,0,0.02)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: 12,
                textAlign: 'center',
              }}
              title={`${t.title || 'sin título'} · tira vacía, sin viñetas todavía`}
            >
              <div style={{ fontSize: 22, color: 'var(--color-text-muted)' }}>▤</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>{t.title || 'sin título'}</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>tira vacía — sin viñetas todavía</div>
            </div>
          ))}
          {items.map((it, idx) => (
            <div
              key={it.key}
              data-no-deselect="1"
              draggable={!selectMode}
              onMouseDown={(e) => { dragOriginRef.current = e.target }}
              onDragStart={(e) => onDragStart(e, idx)}
              onDragOver={(e) => onDragOver(e, idx)}
              onDrop={(e) => onDrop(e, idx)}
              onDragEnd={onDragEnd}
              onClick={() => selectMode ? toggleSelect(it.key) : openItem(it)}
              style={{
                position: 'relative',
                cursor: selectMode ? 'pointer' : 'grab',
                opacity: dragIdx === idx ? 0.4 : 1,
              }}
              title={selectMode ? (selected.has(it.key) ? 'quitar selección' : 'seleccionar') : 'ver en grande — arrastrala para reordenar'}
            >
              {dragIdx != null && insertIdx === idx && (
                <span style={{ position: 'absolute', left: -8, top: 0, bottom: 0, width: 3, background: 'var(--color-accent)', borderRadius: 2, zIndex: 3 }} />
              )}
              {dragIdx != null && insertIdx === idx + 1 && (
                <span style={{ position: 'absolute', right: -8, top: 0, bottom: 0, width: 3, background: 'var(--color-accent)', borderRadius: 2, zIndex: 3 }} />
              )}
              {srcs[it.key] ? (
                <img
                  src={srcs[it.key]}
                  alt=""
                  draggable={false}
                  style={{
                    maxHeight: `${Math.round(55 * tileScale)}vh`,
                    maxWidth: '100%',
                    objectFit: 'contain',
                    display: 'block',
                    cursor: selectMode ? 'pointer' : 'grab',
                    userSelect: 'none',
                  }}
                />
              ) : null}
              {selectMode && (
                <span
                  style={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    border: '2px solid var(--color-accent)',
                    background: selected.has(it.key) ? 'var(--color-accent)' : '#fff',
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    pointerEvents: 'none',
                  }}
                >
                  {selected.has(it.key) ? '✓' : ''}
                </span>
              )}
              {/* Menú desplegable de tira: una tile por viñeta (su portada) */}
              {!selectMode && (
                <select
                  className="input"
                  value={tiraOfStrip[it.stripId] || GENERAL}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => { e.stopPropagation(); assignStripTira(it.stripId, e.target.value) }}
                  title="asignar a una tira (o devolver a general)"
                  style={{ width: '100%', fontSize: 11, marginTop: 4, cursor: 'pointer' }}
                >
                  <option value={GENERAL}>general</option>
                  {scopedTiras.map(t => <option key={t.id} value={t.id}>{t.title || 'sin título'}</option>)}
                </select>
              )}
            </div>
          ))}
        </div>
      )}

      {previewItem && (
        <ImagePreview
          src={srcs[previewItem.key]}
          title={`${previewItem.stripTitle} · resultado ${previewItem.resultIdx + 1}`}
          gallery={previewGallery}
          index={previewIdx}
          onIndex={(i) => setPreviewIdx((i + previewGallery.length) % previewGallery.length)}
          onClose={() => setPreviewIdx(null)}
          actions={[
            {
              label: copiedImg ? 'copiado ✓' : 'copiar',
              title: 'copiar esta imagen al portapapeles',
              onClick: () => copyPreviewImage(previewItem),
            },
            {
              label: isCover(previewItem) ? 'portada ✓' : 'portada',
              title: 'elegir como imagen de preview y export',
              active: isCover(previewItem),
              onClick: () => toggleCover(previewItem),
            },
            {
              label: 'exportar',
              title: `exportar limpio (${format.toUpperCase()})`,
              onClick: () => { exportItem(previewItem).catch(e => console.error('export falló:', e)) },
            },
          ]}
        />
      )}
      </div>
    </ChatLayout>
  )
}