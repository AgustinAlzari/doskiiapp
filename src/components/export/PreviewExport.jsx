import { useEffect, useMemo, useState } from 'react'
import useStripStore from '../../store/stripStore'
import useAuthorStore from '../../store/authorStore'
import useTiraStore from '../../store/tiraStore'
import { confirmDelete } from '../../utils/confirmDelete'
import { exportCleanImage, exportCleanImages, resolveAuthor, slugify, FORMAT_EXT } from '../../services/imageExport'
import ImagePreview from '../ImagePreview'
import ChatLayout from '../chat/ChatLayout'
import TiraCard from '../tiras/TiraCard'
import TiraView from '../tiras/TiraView'
import { coverOf } from '../../utils/stripCover'

// PNG es lossless; JPEG/WebP exportan con el máximo factor de calidad.
const FORMATS = [
  { id: 'png', label: 'PNG', quality: undefined },
  { id: 'jpeg', label: 'JPEG', quality: 1 },
  { id: 'webp', label: 'WebP', quality: 1 },
]

const keyOf = (stripId, resultId) => `${stripId}:${resultId}`

// Mosaico puro: todas las imágenes del proyecto solas, en orden de lectura
// (izquierda → derecha, arriba → abajo). Clic en una imagen → preview completo
// con zoom, exportar limpio y usar como portada. Las tiras se arman con
// "seleccionar" + "mover acá" (o ⌘V con la viñeta copiada).
export default function PreviewExport({ project, strips, characters, backgrounds, objects, focusStripId }) {
  const saveStrip = useStripStore(s => s.save)
  const authors = useAuthorStore(s => s.authors)
  const author = useMemo(() => resolveAuthor(project, authors), [project, authors])

  const tiras = useTiraStore(s => s.tiras)
  const saveTira = useTiraStore(s => s.save)
  const removeTira = useTiraStore(s => s.remove)
  const createTira = useTiraStore(s => s.create)
  const scopedTiras = tiras.filter(t => t.projectId === project?.id)
  const [openTiraId, setOpenTiraId] = useState(null)
  const [editingTiraId, setEditingTiraId] = useState(null)
  const openTira = openTiraId ? scopedTiras.find(t => t.id === openTiraId) || null : null

  const addStripToTira = (tiraId, stripId) => {
    const t = useTiraStore.getState().tiras.find(x => x.id === tiraId)
    if (!t || (t.stripIds || []).includes(stripId)) return
    saveTira({ ...t, stripIds: [...(t.stripIds || []), stripId] })
  }

  const newTira = async () => {
    const n = scopedTiras.length + 1
    const t = await createTira(project?.id, `tira ${n}`)
    setEditingTiraId(t.id)
  }

  const stripsState = useStripStore(s => s.strips)
  const liveStrips = useMemo(
    () => (strips || []).map(s => stripsState.find(x => x.id === s.id) || s),
    [strips, stripsState]
  )

  // Viñetas dentro de alguna tira: "movidas" a una subcarpeta → se ocultan de la
  // galería general (madre) y de exportar todas. Solo se ven sueltas las libres.
  const inTiraIds = useMemo(
    () => new Set(scopedTiras.flatMap(t => t.stripIds || [])),
    [scopedTiras]
  )
  const looseStrips = useMemo(() => liveStrips.filter(s => !inTiraIds.has(s.id)), [liveStrips, inTiraIds])

  const allItems = useMemo(
    () => looseStrips.flatMap(s =>
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
    [looseStrips]
  )

  const defaultItems = useMemo(
    () => looseStrips.flatMap(s => {
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
    [looseStrips]
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
  const [copiedImg, setCopiedImg] = useState(false)
  const [tileScale, setTileScale] = useState(1)
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState(new Set())

  // Ids de viñetas de las imágenes seleccionadas (para "mover acá" en una tira).
  const selectedStripIds = useMemo(
    () => [...new Set(items.filter(it => selected.has(it.key)).map(it => it.stripId).filter(Boolean))],
    [items, selected]
  )

  const moveSelectedToTira = (tiraId) => {
    selectedStripIds.forEach(id => addStripToTira(tiraId, id))
    setSelected(new Set())
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

  // Para tiles normales abre el preview; para tiles destildadas abre el primer
  // resultado de la viñeta (así se puede volver a elegir una portada).
  const openItem = (it) => {
    if (it.none) {
      const i = allItems.findIndex(x => x.stripId === it.stripId)
      if (i >= 0) setPreviewIdx(i)
      return
    }
    openPreview(it.key)
  }

  const previewItem = allItems[previewIdx]
  const previewGallery = allItems
    .filter(it => srcs[it.key])
    .map(it => ({ src: srcs[it.key], title: `${it.stripTitle} · resultado ${it.resultIdx + 1}` }))

  if (openTira) {
    return (
      <TiraView
        tira={openTira}
        strips={liveStrips}
        project={project}
        authors={authors}
        onBack={() => setOpenTiraId(null)}
      />
    )
  }

  return (
    <ChatLayout>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Encabezado + slider: fijos al scrollear (fondo blanco desde arriba, esconde lo que pasa debajo) */}
      <div style={{ position: 'sticky', top: 0, zIndex: 500, background: 'var(--color-bg)', paddingBottom: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Encabezado */}
      <div className="section-header" style={{ flexWrap: 'wrap', alignItems: 'center', marginBottom: 0, justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 220, flex: 1 }}>
          <h1 className="ui-h1" style={{ marginBottom: 0 }}>preview y export</h1>
          {project?.name && (
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{project.name}</div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }} data-no-deselect="1">
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
          <button className="btn btn-sm" onClick={newTira} title="crear una tira: carpeta que reúne viñetas">nueva tira</button>
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
      </div>

      {/* Categoría tiras: carpetas que reúnen viñetas */}
      {scopedTiras.length > 0 && (
        <div data-no-deselect="1">
          <div className="label" style={{ marginBottom: 8 }}>tiras</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
            {scopedTiras.map(t => (
              <div key={t.id} style={{ position: 'relative' }}>
                <TiraCard
                  tira={t}
                  strips={liveStrips}
                  onOpen={() => setOpenTiraId(t.id)}
                  onAddStrip={(stripId) => addStripToTira(t.id, stripId)}
                  pendingStripIds={selectedStripIds}
                  onMoveSelected={moveSelectedToTira}
                  editing={editingTiraId === t.id}
                  onDone={(title) => { saveTira({ ...t, title }); setEditingTiraId(null) }}
                />
                <button
                  className="btn btn-ghost btn-sm btn-danger"
                  style={{ position: 'absolute', top: 4, right: 4, zIndex: 2, background: '#fff' }}
                  onClick={async (e) => { e.stopPropagation(); if (await confirmDelete(t.title || 'tira', false)) removeTira(t.id) }}
                  title="eliminar tira"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mosaico puro */}
      {items.length === 0 ? (
        <div className="card" style={{ padding: 16, fontSize: 13, color: 'var(--color-text-muted)' }}>
          este proyecto no tiene resultados todavía. pegá la imagen que generó la IA en la vista de prompts de una viñeta.
        </div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'flex-start' }}>
          {items.map((it) => (
            <div
              key={it.key}
              data-no-deselect="1"
              onClick={() => selectMode ? toggleSelect(it.key) : openItem(it)}
              style={{
                position: 'relative',
                cursor: selectMode ? 'pointer' : 'zoom-in',
              }}
              title={selectMode ? (selected.has(it.key) ? 'quitar selección' : 'seleccionar') : (it.none ? 'destildada: elegir portada para que vuelva a preview y export' : 'ver en grande')}
            >
              {it.none ? (
                <div
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
                >
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-2)' }}>{it.stripTitle}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>sin exportar</div>
                  <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>click: elegir portada</div>
                </div>
              ) : (srcs[it.key] ? (
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
              ) : null)}
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
