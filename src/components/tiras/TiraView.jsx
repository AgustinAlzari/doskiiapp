import { useEffect, useMemo, useRef, useState } from 'react'
import useTiraStore from '../../store/tiraStore'
import useStripStore from '../../store/stripStore'
import useClipboardStore from '../../store/clipboardStore'
import useProjectStore from '../../store/projectStore'
import { exportCleanImages, resolveAuthor, slugify, FORMAT_EXT } from '../../services/imageExport'
import { confirmDelete, isInCloud } from '../../utils/confirmDelete'
import { coverOf, coverKeyOf } from '../../utils/stripCover'
import ImagePreview from '../ImagePreview'
import ChatLayout from '../chat/ChatLayout'
import StripCard from '../StripCard'

const FORMATS = [
  { id: 'png', label: 'PNG', quality: undefined },
  { id: 'jpeg', label: 'JPEG', quality: 1 },
  { id: 'webp', label: 'WebP', quality: 1 },
]

// Vista de una tira: reúne viñetas en orden (reordenables arrastrando) y exporta
// SOLO la tira, anteponiendo a cada archivo el número de ubicación del elemento.
// `asCards` = fichas completas de viñeta (vista "viñetas"); sin él, imágenes
// sueltas a tamaño natural (vista "preview y export", como siempre fue).
export default function TiraView({ tira, strips, project, authors, onBack, onOpenStrip, asCards = false }) {
  const save = useTiraStore(s => s.save)
  const tiras = useTiraStore(s => s.tiras)
  const copyStrip = useClipboardStore(s => s.copy)
  const removeStripStore = useStripStore(s => s.remove)
  const saveStrip = useStripStore(s => s.save)
  const duplicate = useStripStore(s => s.duplicate)
  const projects = useProjectStore(s => s.projects)
  const scopedTiras = tiras.filter(t => t.projectId === project?.id)
  const liveStrips = useMemo(
    () => strips.map(s => ({ ...s })).filter(s => (tira.stripIds || []).includes(s.id)),
    [strips, tira.stripIds]
  )
  const ordered = useMemo(() => {
    const byId = {}
    liveStrips.forEach(s => { byId[s.id] = s })
    return (tira.stripIds || []).map(id => byId[id]).filter(Boolean)
  }, [liveStrips, tira.stripIds])

  const author = useMemo(() => resolveAuthor(project, authors || []), [project, authors])
  const [format, setFormat] = useState('png')
  const [exporting, setExporting] = useState(false)
  const [srcs, setSrcs] = useState({})
  const [preview, setPreview] = useState(null)
  const [dragIdx, setDragIdx] = useState(null)
  const [insertIdx, setInsertIdx] = useState(null)
  const [copiedId, setCopiedId] = useState(null)
  const [newStripId, setNewStripId] = useState(null)
  const dragOriginRef = useRef(null)

  // Notas de la tira: se guardan al salir de la caja.
  const [notes, setNotes] = useState(tira?.notes || '')
  useEffect(() => { setNotes(tira?.notes || '') }, [tira?.id])

  const doCopy = (id) => {
    copyStrip(id)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  // En modo imágenes, carga las portadas de las viñetas para mostrarlas sueltas (batch).
  useEffect(() => {
    if (asCards) return
    let active = true
    const load = async () => {
      const entries = ordered.map(s => ({ s, r: coverOf(s) })).filter(x => x.r?.path)
      const paths = entries.map(x => x.r.path)
      let map = {}
      if (paths.length && window.api?.references) {
        try {
          if (window.api.references.readMany) map = await window.api.references.readMany(paths)
          else {
            const results = await Promise.all(paths.map(async p => [p, await window.api.references.read(p)]))
            map = Object.fromEntries(results.filter(([, v]) => v))
          }
        } catch {}
      }
      if (!active) return
      const next = {}
      for (const { s, r } of entries) {
        const url = map[r.path]
        if (url) next[coverKeyOf(s)] = url
      }
      setSrcs(next)
    }
    load()
    return () => { active = false }
  }, [asCards, ordered])

  const update = (nextTira) => save({ ...tira, ...nextTira })

  const persistOrder = (list) => {
    update({ stripIds: list.map(s => s.id) })
  }

  // Crea una viñeta nueva dentro de la tira: adopta el nombre y formato de la
  // tira (primera viñeta o el default del proyecto) y queda como tarjetón con el
  // nombre en edición. Si no se le pone nombre, conserva "tira + N".
  const createStripInTira = async () => {
    const n = ordered.length + 1
    const strip = {
      id: crypto.randomUUID(),
      projectId: project?.id,
      title: `${tira.title || 'tira'} ${n}`,
      panelCount: 1,
      aspectRatio: ordered[0]?.aspectRatio || project?.defaultAspectRatio || 'hd',
      panels: [{
        id: crypto.randomUUID(),
        scene: '',
        characters: [],
        backgroundId: null,
        objects: [],
        narration: null,
      }],
      createdAt: new Date().toISOString(),
    }
    await saveStrip(strip)
    update({ stripIds: [...(tira.stripIds || []), strip.id] })
    setNewStripId(strip.id)
  }

  const renameStrip = (strip, title) => {
    saveStrip({ ...strip, title })
    if (newStripId === strip.id) setNewStripId(null)
  }

  // Duplica una viñeta que está dentro de la tira: la copia queda también en la
  // tira (al final de stripIds), no vuelve a general.
  const duplicateInTira = async (strip) => {
    const copy = await duplicate(strip)
    update({ stripIds: [...(tira.stripIds || []), copy.id] })
    return copy
  }

  const onDragStart = (e, idx) => {
    // Si el arrastre empieza sobre un control (copiar/quitar), cancelarlo para
    // que el clic funcione aunque haya algo de movimiento (trackpad).
    if (dragOriginRef.current?.closest?.('[data-no-drag]')) {
      e.preventDefault()
      return
    }
    setDragIdx(idx)
    setInsertIdx(null)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('application/x-doski-strip', ordered[idx].id)
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
      const next = [...ordered]
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

  const removeStrip = (stripId) => {
    update({ stripIds: (tira.stripIds || []).filter(id => id !== stripId) })
  }

  // Asigna una viñeta a otra tira (o a general): sale de la actual antes de entrar.
  const assignStripTira = (stripId, tiraId) => {
    if (tiraId === tira.id) return
    const current = tiras.find(x => x.id === tira.id)
    if (current) save({ ...current, stripIds: (current.stripIds || []).filter(id => id !== stripId) })
    if (tiraId) {
      const target = tiras.find(x => x.id === tiraId)
      if (target && !(target.stripIds || []).includes(stripId)) {
        save({ ...target, stripIds: [...(target.stripIds || []), stripId] })
      }
    }
  }

  const exportTira = async () => {
    setExporting(true)
    try {
      const f = FORMATS.find(x => x.id === format)
      const pad = String(ordered.length).length
      const items = ordered
        .map((s, i) => {
          const r = coverOf(s)
          if (!r?.path) return null
          return {
            sourcePath: r.path,
            title: s.title,
            fileName: `${String(i + 1).padStart(pad, '0')}-${slugify(s.title || 'sin título')}.${FORMAT_EXT[format]}`,
          }
        })
        .filter(Boolean)
      await exportCleanImages({ items, author, format, quality: f?.quality })
    } catch (e) {
      console.error('export tira falló:', e)
    }
    setExporting(false)
  }

  const openStrip = (s) => {
    const r = coverOf(s)
    if (r?.path && window.api?.references) {
      window.api.references.read(r.path).then(url => { if (url) setPreview({ src: url, title: s.title || 'sin título' }) })
    }
  }

  return (
    <ChatLayout>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="section-header" style={{ flexWrap: 'wrap', gap: 12, alignItems: 'flex-start' }}>
          <button className="back-arrow" onClick={onBack} title="volver">←</button>
          <div style={{ flex: 1, minWidth: 200 }}>
            <input
              className="input"
              value={tira.title || ''}
              onChange={e => update({ title: e.target.value })}
              placeholder="nombre de la tira"
              style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}
            />
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
              {ordered.length} {ordered.length === 1 ? 'viñeta' : 'viñetas'} · tira
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, alignSelf: 'flex-end', marginBottom: 22 }}>
            <button className="btn btn-sm" onClick={createStripInTira} title="crear una viñeta nueva dentro de esta tira (toma su nombre y formato)">nueva viñeta</button>
            <select className="input" style={{ width: 'auto', fontSize: 12, cursor: 'pointer' }} value={format} onChange={e => setFormat(e.target.value)}>
              {FORMATS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>
            <button className="btn btn-sm" onClick={exportTira} disabled={exporting || ordered.length === 0}>
              {exporting ? 'exportando...' : 'exportar tira'}
            </button>
          </div>
        </div>

        {ordered.length === 0 ? (
          <div className="card" style={{ padding: 20, fontSize: 13, color: 'var(--color-text-muted)' }}>
            esta tira está vacía. agregá viñetas con seleccionar + mover acá desde preview y export, arrastrando desde viñetas, o pegando con ⌘V.
          </div>
        ) : asCards ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'flex-start' }}>
            {ordered.map((s, idx) => (
              <StripCard
                key={s.id}
                strip={s}
                idx={idx}
                badge={idx + 1}
                draggable
                dragging={dragIdx === idx}
                insertBefore={dragIdx != null && insertIdx === idx}
                insertAfter={dragIdx != null && insertIdx === idx + 1}
                onMouseDown={(e) => { dragOriginRef.current = e.target }}
                onDragStart={(e) => onDragStart(e, idx)}
                onDragOver={(e) => onDragOver(e, idx)}
                onDrop={(e) => onDrop(e, idx)}
                onDragEnd={onDragEnd}
                onOpen={(st) => onOpenStrip ? onOpenStrip(st) : openStrip(st)}
                onDuplicate={duplicateInTira}
                onCopy={doCopy}
                copied={copiedId === s.id}
                editing={newStripId === s.id}
                onRename={(title) => renameStrip(s, title)}
                removeTitle="eliminar viñeta"
                onRemove={async (st) => { if (await confirmDelete(st.title || 'viñeta', isInCloud(st, projects))) removeStripStore(st.id) }}
                tiraOptions={scopedTiras.map(t => ({ id: t.id, title: t.title }))}
                tiraId={tira.id}
                onAssignTira={assignStripTira}
              />
            ))}
            {/* Botón "+": agrega un tarjetón al final de la tira (mismo alto que una tarjeta) */}
            <button
              className="btn"
              onClick={createStripInTira}
              title="nueva viñeta en esta tira"
              style={{
                width: 220,
                minHeight: 210,
                height: 'auto',
                border: '2px dashed var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                background: 'rgba(0,0,0,0.02)',
                fontSize: 30,
                fontWeight: 400,
                color: 'var(--color-text-muted)',
                cursor: 'pointer',
                alignSelf: 'flex-start',
              }}
            >
              +
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'flex-start' }}>
            {ordered.map((s, idx) => (
              <div
                key={s.id}
                draggable
                onMouseDown={(e) => { dragOriginRef.current = e.target }}
                onDragStart={e => onDragStart(e, idx)}
                onDragOver={e => onDragOver(e, idx)}
                onDrop={e => onDrop(e, idx)}
                onDragEnd={onDragEnd}
                style={{ position: 'relative', opacity: dragIdx === idx ? 0.4 : 1, cursor: 'grab' }}
              >
                {dragIdx != null && insertIdx === idx && (
                  <span style={{ position: 'absolute', left: -8, top: 0, bottom: 0, width: 3, background: 'var(--color-accent)', borderRadius: 2, zIndex: 3 }} />
                )}
                {dragIdx != null && insertIdx === idx + 1 && (
                  <span style={{ position: 'absolute', right: -8, top: 0, bottom: 0, width: 3, background: 'var(--color-accent)', borderRadius: 2, zIndex: 3 }} />
                )}
                <div style={{ position: 'absolute', top: 4, left: 4, zIndex: 2, background: '#fff', border: '1px solid var(--color-border)', borderRadius: 4, fontSize: 11, padding: '0 6px', color: 'var(--color-text-2)' }}>
                  {idx + 1}
                </div>
                <span
                  data-no-drag
                  onClick={(e) => { e.stopPropagation(); doCopy(s.id) }}
                  title={copiedId === s.id ? 'copiada ✓ (⌘V en una tira)' : 'copiar viñeta (⌘C)'}
                  style={{ position: 'absolute', top: 4, left: 34, zIndex: 2, fontSize: 11, color: copiedId === s.id ? 'var(--color-text)' : 'var(--color-text-muted)', cursor: 'pointer', background: '#fff', border: '1px solid var(--color-border)', borderRadius: 4, padding: '0 5px', lineHeight: 1.4, fontWeight: 600 }}
                >
                  {copiedId === s.id ? '✓' : 'copiar'}
                </span>
                {srcs[coverKeyOf(s)] ? (
                  <img
                    key={coverKeyOf(s)}
                    src={srcs[coverKeyOf(s)]}
                    alt=""
                    draggable={false}
                    onClick={() => onOpenStrip ? onOpenStrip(s) : openStrip(s)}
                    style={{ maxHeight: '40vh', maxWidth: '100%', objectFit: 'contain', display: 'block', cursor: 'zoom-in', userSelect: 'none' }}
                    title={s.title || 'sin título'}
                  />
                ) : null}
                <div style={{ fontSize: 11, color: 'var(--color-text-2)', marginTop: 4, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s.title || 'sin título'}
                </div>
                <span
                  data-no-drag
                  onClick={(e) => { e.stopPropagation(); removeStrip(s.id) }}
                  title="quitar de la tira"
                  style={{ position: 'absolute', top: 4, right: 4, zIndex: 2, fontSize: 14, color: 'var(--color-text-muted)', cursor: 'pointer', background: '#fff', borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}
                >×</span>
              </div>
            ))}
          </div>
        )}

        {/* Footer de notas: solo cuando la tira tiene contenido, se guardan al salir de la caja */}
        {ordered.length > 0 && (
          <div style={{ marginTop: 8, borderTop: '1px solid var(--color-border-muted)', paddingTop: 12 }}>
            <div style={{ marginBottom: 6 }}>
              <span className="label">notas</span>
            </div>
            <textarea
              className="input textarea"
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => update({ notes })}
              placeholder="notas de la tira..."
              style={{ width: '100%', resize: 'none', overflowY: 'auto', lineHeight: 1.5 }}
            />
          </div>
        )}

        {preview && (
          <ImagePreview src={preview.src} title={preview.title} onClose={() => setPreview(null)} />
        )}
      </div>
    </ChatLayout>
  )
}
