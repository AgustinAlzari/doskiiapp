import { useEffect, useMemo, useState } from 'react'
import useStripStore from '../../store/stripStore'
import useProjectStore from '../../store/projectStore'
import useAuthorStore from '../../store/authorStore'
import { exportCleanImage, resolveAuthor, slugify, FORMAT_EXT } from '../../services/imageExport'
import ImagePreview from '../ImagePreview'
import ChatLayout from '../chat/ChatLayout'

// PNG es lossless; JPEG/WebP exportan con el máximo factor de calidad.
const FORMATS = [
  { id: 'png', label: 'PNG', quality: undefined },
  { id: 'jpeg', label: 'JPEG', quality: 1 },
  { id: 'webp', label: 'WebP', quality: 1 },
]

const keyOf = (stripId, resultId) => `${stripId}:${resultId}`

// Mosaico puro: todas las imágenes del proyecto solas, en orden de lectura
// (izquierda → derecha, arriba → abajo). Se pueden reordenar arrastrando;
// el orden se guarda en `project.galleryOrder`. Clic en una imagen → preview
// completo con zoom, exportar limpio y usar como portada.
export default function PreviewExport({ project, strips, characters, backgrounds, objects, focusStripId }) {
  const saveProject = useProjectStore(s => s.save)
  const saveStrip = useStripStore(s => s.save)
  const authors = useAuthorStore(s => s.authors)
  const author = useMemo(() => resolveAuthor(project, authors), [project, authors])

  const stripsState = useStripStore(s => s.strips)
  const liveStrips = useMemo(
    () => (strips || []).map(s => stripsState.find(x => x.id === s.id) || s),
    [strips, stripsState]
  )

  const allItems = useMemo(
    () => liveStrips.flatMap(s =>
      (s.results || []).map((r, idx) => ({
        key: keyOf(s.id, r.id),
        stripId: s.id,
        stripTitle: s.title || 'sin título',
        resultId: r.id,
        resultIdx: idx,
        path: r.path,
        pasted: r.pasted,
      }))
    ),
    [liveStrips]
  )

  const defaultItems = useMemo(
    () => liveStrips.flatMap(s => {
      const results = s.results || []
      if (results.length === 0) return []
      const idx = Math.min(Math.max(0, s.resultCoverIndex ?? results.length - 1), results.length - 1)
      const r = results[idx]
      return [{
        key: keyOf(s.id, r.id),
        stripId: s.id,
        stripTitle: s.title || 'sin título',
        resultId: r.id,
        resultIdx: idx,
        path: r.path,
        pasted: r.pasted,
      }]
    }),
    [liveStrips]
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

  // Carga las fuentes (data URL) de cada imagen del mosaico.
  const [srcs, setSrcs] = useState({})
  useEffect(() => {
    let active = true
    const load = async () => {
      const next = {}
      for (const it of allItems) {
        if (!it.path || !window.api?.references) continue
        try {
          const url = await window.api.references.read(it.path)
          if (active && url) next[it.key] = url
        } catch {}
      }
      if (active) setSrcs(next)
    }
    load()
    return () => { active = false }
  }, [allItems])

  const [previewIdx, setPreviewIdx] = useState(null)
  const [format, setFormat] = useState('png')
  const [exportingAll, setExportingAll] = useState(false)
  const [tileScale, setTileScale] = useState(1)
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState(new Set())

  const [dragIdx, setDragIdx] = useState(null)
  const [insertIdx, setInsertIdx] = useState(null)

  const toggleSelect = (key) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const persistOrder = (ordered) => {
    const galleryOrder = ordered.map(it => it.key)
    saveProject({ ...project, galleryOrder })
  }

  const onDragStart = (e, idx) => {
    if (selectMode) return
    setDragIdx(idx)
    setInsertIdx(null)
    e.dataTransfer.effectAllowed = 'move'
  }
  const onDragOver = (e, idx) => {
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

  const exportAll = async () => {
    setExportingAll(true)
    try {
      for (let i = 0; i < allItems.length; i++) {
        const res = await exportItem(allItems[i])
        if (!res) break // el usuario canceló el diálogo
      }
    } catch (e) {
      console.error('export todas falló:', e)
    }
    setExportingAll(false)
  }

  const exportSelected = async () => {
    setExportingAll(true)
    try {
      for (const it of items) {
        if (!selected.has(it.key)) continue
        const res = await exportItem(it)
        if (!res) break // el usuario canceló el diálogo
      }
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

  const previewItem = allItems[previewIdx]
  const previewGallery = allItems
    .filter(it => srcs[it.key])
    .map(it => ({ src: srcs[it.key], title: `${it.stripTitle} · resultado ${it.resultIdx + 1}` }))

  return (
    <ChatLayout>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Encabezado */}
      <div className="section-header" style={{ flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <h1 className="ui-h1" style={{ marginBottom: 4 }}>preview y export</h1>
          {project?.name && (
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{project.name}</div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{allItems.length} {allItems.length === 1 ? 'resultado' : 'resultados'}</span>
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
      <div style={{ display: 'flex', alignItems: 'center', padding: '2px 0' }}>
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
      </div>

      {/* Mosaico puro */}
      {items.length === 0 ? (
        <div className="card" style={{ padding: 16, fontSize: 13, color: 'var(--color-text-muted)' }}>
          este proyecto no tiene resultados todavía. pegá la imagen que generó la IA en la vista de prompts de una viñeta.
        </div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'flex-start' }}>
          {items.map((it, idx) => (
            <div
              key={it.key}
              draggable={!selectMode}
              onDragStart={e => onDragStart(e, idx)}
              onDragOver={e => onDragOver(e, idx)}
              onDrop={e => onDrop(e, idx)}
              onDragEnd={onDragEnd}
              onClick={() => selectMode ? toggleSelect(it.key) : openPreview(it.key)}
              style={{
                position: 'relative',
                opacity: dragIdx === idx ? 0.4 : 1,
                cursor: selectMode ? 'pointer' : 'grab',
              }}
              title={selectMode ? (selected.has(it.key) ? 'quitar selección' : 'seleccionar') : 'ver en grande'}
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
                    cursor: selectMode ? 'pointer' : 'zoom-in',
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
