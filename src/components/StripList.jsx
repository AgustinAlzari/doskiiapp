import { useEffect, useMemo, useRef, useState } from 'react'
import useStripStore from '../store/stripStore'
import useTiraStore, { isDefaultTira } from '../store/tiraStore'
import useClipboardStore from '../store/clipboardStore'
import useAuthorStore from '../store/authorStore'
import useProjectStore from '../store/projectStore'
import { confirmDelete, isInCloud } from '../utils/confirmDelete'
import GalleryPreview from './GalleryPreview'
import ChatLayout from './chat/ChatLayout'
import StripCard from './StripCard'
import TiraCard from './tiras/TiraCard'
import TiraView from './tiras/TiraView'

export default function StripList({ project, projectId, initialOpenTiraId = null, onNew, onEdit }) {
  const strips = useStripStore(s => s.strips)
  const loaded = useStripStore(s => s.loaded)
  const remove = useStripStore(s => s.remove)
  const reorder = useStripStore(s => s.reorder)
  const duplicate = useStripStore(s => s.duplicate)
  const tiras = useTiraStore(s => s.tiras)
  const saveTira = useTiraStore(s => s.save)
  const removeTira = useTiraStore(s => s.remove)
  const createTira = useTiraStore(s => s.create)
  const reorderTira = useTiraStore(s => s.reorder)
  const ensureDefault = useTiraStore(s => s.ensureDefault)
  const copyStrip = useClipboardStore(s => s.copy)
  const authors = useAuthorStore(s => s.authors)
  const projects = useProjectStore(s => s.projects)
  const saveProject = useProjectStore(s => s.save)
  const scopedStrips = strips.filter(s => s.projectId === projectId)
  const scopedTiras = tiras.filter(t => t.projectId === projectId)

  // Tira "borrador" por defecto del proyecto.
  useEffect(() => { ensureDefault(projectId) }, [projectId, ensureDefault])
  // Viñetas dentro de alguna tira: "movidas" a subcarpeta → se ocultan de la lista
  // general (madre); solo se ven sueltas las libres.
  const inTiraIds = new Set(scopedTiras.flatMap(t => t.stripIds || []))
  const looseStrips = scopedStrips.filter(s => !inTiraIds.has(s.id))
  const hasAnyResult = scopedStrips.some(s => (s.results || []).length)
  const hasEmptyTira = scopedTiras.some(t => (t.stripIds || []).length === 0)
  const canOpenGallery = hasAnyResult || hasEmptyTira
  const author = project?.authorId ? (authors.find(a => a.id === project.authorId) || null) : null

  const [dragIdx, setDragIdx] = useState(null)
  const [insertIdx, setInsertIdx] = useState(null)
  const [tiraDragIdx, setTiraDragIdx] = useState(null)
  const [tiraInsertIdx, setTiraInsertIdx] = useState(null)
  const [gallery, setGallery] = useState(null)
  const [openTiraId, setOpenTiraId] = useState(initialOpenTiraId)
  const [editingTiraId, setEditingTiraId] = useState(null)
  const [copiedId, setCopiedId] = useState(null)
  const dragOriginRef = useRef(null)
  const openTira = openTiraId ? scopedTiras.find(t => t.id === openTiraId) || null : null

  const addStripToTira = (tiraId, stripId) => {
    const t = tiras.find(x => x.id === tiraId)
    if (!t) return
    if ((t.stripIds || []).includes(stripId)) return
    saveTira({ ...t, stripIds: [...(t.stripIds || []), stripId] })
  }

  // Qué tira contiene a cada viñeta (general = no está en ninguna).
  const tiraIdOfStrip = useMemo(() => {
    const map = {}
    for (const t of scopedTiras) {
      for (const id of (t.stripIds || [])) {
        if (!map[id]) map[id] = t.id
      }
    }
    return map
  }, [scopedTiras])

  // Asigna una viñeta a una tira (o la devuelve a general): sale de la tira
  // actual antes de entrar a la elegida.
  const assignStripTira = (stripId, tiraId) => {
    const current = tiraIdOfStrip[stripId]
    if (current) {
      const t = tiras.find(x => x.id === current)
      if (t) saveTira({ ...t, stripIds: (t.stripIds || []).filter(id => id !== stripId) })
    }
    if (tiraId) {
      const t = tiras.find(x => x.id === tiraId)
      if (t && !(t.stripIds || []).includes(stripId)) {
        saveTira({ ...t, stripIds: [...(t.stripIds || []), stripId] })
      }
    }
  }

  const newTira = async () => {
    const n = scopedTiras.filter(t => !isDefaultTira(t)).length + 1
    const t = await createTira(projectId, `tira ${n}`)
    setEditingTiraId(t.id)
  }

  const doCopy = (id) => {
    copyStrip(id)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  // Galería de todos los resultados del proyecto en el orden de la lista de viñetas.
  const openGallery = async () => {
    if (!window.api?.references) return
    const items = []
    for (const s of looseStrips) {
      const results = s.results || []
      for (let ri = 0; ri < results.length; ri++) {
        const src = await window.api.references.read(results[ri].path)
        if (src) {
          items.push({
            src,
            title: `${s.title || 'sin título'} · resultado ${ri + 1}`,
            path: results[ri].path,
            stripTitle: s.title || 'sin título',
            resultNum: ri + 1,
          })
        }
      }
    }
    // Tiras vacías también se ven en la galería, como tarjeta sin viñetas.
    for (const t of scopedTiras) {
      if ((t.stripIds || []).length === 0) {
        items.push({ isTira: true, tiraTitle: t.title || 'sin título' })
      }
    }
    if (items.length) setGallery(items)
  }

  const onDragStart = (e, idx) => {
    // Si el arrastre empieza sobre un control (duplicar/copiar/eliminar),
    // cancelarlo para que el clic funcione aunque haya algo de movimiento.
    if (dragOriginRef.current?.closest?.('[data-no-drag]')) {
      e.preventDefault()
      return
    }
    setDragIdx(idx)
    setInsertIdx(null)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('application/x-doski-strip', looseStrips[idx].id)
  }
  const onDragOver = (e, idx) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    // Indicador del ESPACIO entre tarjetas: izquierda o derecha según el puntero.
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
      const next = [...looseStrips]
      const [moved] = next.splice(dragIdx, 1)
      let at = target > dragIdx ? target - 1 : target
      at = Math.max(0, Math.min(next.length, at))
      next.splice(at, 0, moved)
      reorder(projectId, next.map(s => s.id))
    }
    setDragIdx(null)
    setInsertIdx(null)
  }
  const onDragEnd = () => { setDragIdx(null); setInsertIdx(null) }

  // Tiras visibles en la sección (las que se pueden reordenar arrastrando).
  const visibleTiras = scopedTiras.filter(t => (t.stripIds || []).length > 0 || editingTiraId === t.id)
  const onTiraDragStart = (e, idx) => {
    if (dragOriginRef.current?.closest?.('[data-no-drag]')) {
      e.preventDefault()
      return
    }
    setTiraDragIdx(idx)
    setTiraInsertIdx(null)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('application/x-doski-tira', visibleTiras[idx].id)
  }
  const onTiraDragOver = (e, idx) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const rect = e.currentTarget.getBoundingClientRect()
    const before = e.clientX < rect.left + rect.width / 2
    const next = before ? idx : idx + 1
    if (next !== tiraInsertIdx) setTiraInsertIdx(next)
  }
  const onTiraDrop = (e, idx) => {
    e.preventDefault()
    if (tiraDragIdx != null) {
      let target = tiraInsertIdx
      if (target == null) {
        const rect = e.currentTarget.getBoundingClientRect()
        target = e.clientX < rect.left + rect.width / 2 ? idx : idx + 1
      }
      const next = [...visibleTiras]
      const [moved] = next.splice(tiraDragIdx, 1)
      let at = target > tiraDragIdx ? target - 1 : target
      at = Math.max(0, Math.min(next.length, at))
      next.splice(at, 0, moved)
      reorderTira(projectId, next.map(t => t.id))
    }
    setTiraDragIdx(null)
    setTiraInsertIdx(null)
  }
  const onTiraDragEnd = () => { setTiraDragIdx(null); setTiraInsertIdx(null) }

  if (!loaded) return <div style={{ color: 'var(--color-text-muted)', padding: 24 }}>cargando...</div>

  if (openTira) {
    return (
      <TiraView
        tira={openTira}
        strips={scopedStrips}
        project={project}
        authors={authors}
        onBack={() => setOpenTiraId(null)}
        onOpenStrip={(strip) => onEdit(strip, openTiraId)}
        asCards
      />
    )
  }

  return (
    <ChatLayout>
      <div>
        <div className="section-header" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 className="ui-h1" style={{ margin: 0 }}>viñetas</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              className="btn btn-sm"
              onClick={openGallery}
              title={canOpenGallery ? (hasAnyResult ? 'ver todos los resultados en galería' : 'ver las tiras vacías en galería') : 'sin resultados para ver'}
              style={{
                color: canOpenGallery ? 'var(--color-text)' : 'var(--color-text-muted)',
                cursor: canOpenGallery ? 'pointer' : 'default',
              }}
            >
              ver
            </button>
            <button className="btn btn-sm" onClick={onNew}>nueva viñeta</button>
            <button className="btn btn-sm" onClick={newTira} title="crear una tira: carpeta que reúne viñetas">nueva tira</button>
          </div>
        </div>

      {/* Sección de tiras (carpetas de viñetas): general (directorio base) + tiras.
          Solo se muestran las que tienen viñetas (o las que se están renombrando):
          una tira vacía no aporta nada a la vista. */}
      {(looseStrips.length > 0 || scopedTiras.some(t => (t.stripIds || []).length > 0) || editingTiraId != null) && (
        <div style={{ margin: '0 0 24px' }}>
          <div className="label" style={{ marginBottom: 8 }}>tiras</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
            {looseStrips.length > 0 && (
              <div key="general" style={{ position: 'relative' }}>
                <TiraCard
                  tira={{ id: 'general', title: 'general', stripIds: looseStrips.map(s => s.id), default: true }}
                  strips={scopedStrips}
                  general
                  count={looseStrips.length}
                  onAddStrip={(stripId) => assignStripTira(stripId, null)}
                />
              </div>
            )}
            {visibleTiras.map((t, idx) => (
              <div
                key={t.id}
                draggable
                onMouseDown={(e) => { dragOriginRef.current = e.target }}
                onDragStart={(e) => onTiraDragStart(e, idx)}
                onDragOver={(e) => onTiraDragOver(e, idx)}
                onDrop={(e) => onTiraDrop(e, idx)}
                onDragEnd={onTiraDragEnd}
                style={{ position: 'relative', opacity: tiraDragIdx === idx ? 0.4 : 1, cursor: 'grab' }}
              >
                {tiraDragIdx != null && tiraInsertIdx === idx && (
                  <span style={{ position: 'absolute', left: -8, top: 0, bottom: 0, width: 3, background: 'var(--color-accent)', borderRadius: 2, zIndex: 3 }} />
                )}
                {tiraDragIdx != null && tiraInsertIdx === idx + 1 && (
                  <span style={{ position: 'absolute', right: -8, top: 0, bottom: 0, width: 3, background: 'var(--color-accent)', borderRadius: 2, zIndex: 3 }} />
                )}
                <TiraCard
                  tira={t}
                  strips={scopedStrips}
                  onOpen={() => setOpenTiraId(t.id)}
                  onAddStrip={(stripId) => addStripToTira(t.id, stripId)}
                  editing={editingTiraId === t.id}
                  onDone={(title) => { saveTira({ ...t, title }); setEditingTiraId(null) }}
                  onTogglePreview={(tiraId) => { const tt = tiras.find(x => x.id === tiraId); if (tt) saveTira({ ...tt, showInPreview: !tt.showInPreview }) }}
                />
                {!isDefaultTira(t) && (
                  <button
                    data-no-drag
                    className="btn btn-ghost btn-sm btn-danger"
                    style={{ position: 'absolute', top: 4, right: 4, zIndex: 2, background: '#fff' }}
                    onClick={async (e) => { e.stopPropagation(); if (await confirmDelete(t.title || 'tira', false)) removeTira(t.id) }}
                    title="eliminar tira"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {looseStrips.length === 0 ? (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '64px 24px',
          gap: 16,
        }}>
          <div style={{ color: 'var(--color-text-muted)', fontSize: 14, textAlign: 'center' }}>
            {scopedStrips.length === 0 ? 'sin viñetas aún. creá una para empezar.' : 'todas las viñetas están en tiras. quitá una de su tira para volver a verla acá.'}
          </div>
          <button className="btn btn-primary" onClick={onNew}>nueva viñeta</button>
        </div>
      ) : (
        <div className="strip-grid">
          {looseStrips.map((strip, idx) => (
            <StripCard
              key={strip.id}
              strip={strip}
              idx={idx}
              draggable
              dragging={dragIdx === idx}
              insertBefore={dragIdx != null && insertIdx === idx}
              insertAfter={dragIdx != null && insertIdx === idx + 1}
              onMouseDown={(e) => { dragOriginRef.current = e.target }}
              onDragStart={(e) => onDragStart(e, idx)}
              onDragOver={(e) => onDragOver(e, idx)}
              onDrop={(e) => onDrop(e, idx)}
              onDragEnd={onDragEnd}
              onOpen={(s) => onEdit(s, null)}
              onDuplicate={duplicate}
              onCopy={doCopy}
              copied={copiedId === strip.id}
              onRemove={async (s) => { if (await confirmDelete(s.title || 'viñeta', isInCloud(s, projects))) remove(s.id) }}
              tiraOptions={scopedTiras.map(t => ({ id: t.id, title: t.title }))}
              tiraId={tiraIdOfStrip[strip.id] || ''}
              onAssignTira={assignStripTira}
            />
          ))}
        </div>
      )}
      {looseStrips.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <label className="label">nota general</label>
          <textarea
            className="input textarea"
            value={project?.generalNote || ''}
            onChange={e => saveProject({ ...project, generalNote: e.target.value })}
            placeholder="nota de la base general: contexto, continuidad, recordatorios..."
            rows={2}
            style={{ fontSize: 12, lineHeight: 1.5 }}
          />
        </div>
      )}
      {gallery && (
        <GalleryPreview items={gallery} author={author} onClose={() => setGallery(null)} />
      )}
      </div>
    </ChatLayout>
  )
}
