import { useEffect, useMemo, useState } from 'react'
import useStripStore from '../../store/stripStore'
import useAuthorStore from '../../store/authorStore'
import useTiraStore from '../../store/tiraStore'
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
  const authors = useAuthorStore(s => s.authors)
  const author = useMemo(() => resolveAuthor(project, authors), [project, authors])

  const tiras = useTiraStore(s => s.tiras)
  const saveTira = useTiraStore(s => s.save)

  const scopedTiras = tiras.filter(t => t.projectId === project?.id)

  // Tiras seleccionadas que se muestran en el mosaico (general = viñetas sueltas).
  const [selectedTiras, setSelectedTiras] = useState([GENERAL])

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

  // Viñetas visibles: unión de las tiras seleccionadas (general + varias tiras).
  const visibleStrips = useMemo(() => {
    return liveStrips.filter(s => {
      const inTira = tiraOfStrip[s.id]
      if (!inTira) return selectedSet.has(GENERAL)
      return selectedSet.has(inTira)
    })
  }, [liveStrips, tiraOfStrip, selectedSet])

  const allItems = useMemo(
    () => visibleStrips.flatMap(s =>
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
    [visibleStrips]
  )

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

      {/* Galería flotante de imágenes */}
      {items.length === 0 ? (
        <div className="card" style={{ padding: 16, fontSize: 13, color: 'var(--color-text-muted)' }}>
          {visibleStrips.length === 0
            ? 'no hay viñetas en las tiras seleccionadas. elegí una tira en el desplegable de arriba.'
            : 'este proyecto no tiene resultados todavía. pegá la imagen que generó la IA en la vista de prompts de una viñeta.'}
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