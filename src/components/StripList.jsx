import { useEffect, useMemo, useRef, useState } from 'react'
import useStripStore from '../store/stripStore'
import useTiraStore from '../store/tiraStore'
import useClipboardStore from '../store/clipboardStore'
import useAuthorStore from '../store/authorStore'
import useProjectStore from '../store/projectStore'
import { confirmDelete, isInCloud } from '../utils/confirmDelete'
import GalleryPreview from './GalleryPreview'
import ChatLayout from './chat/ChatLayout'
import StripCard from './StripCard'
import TiraCard from './tiras/TiraCard'
import TiraView from './tiras/TiraView'

export default function StripList({ project, projectId, onNew, onEdit }) {
  const strips = useStripStore(s => s.strips)
  const loaded = useStripStore(s => s.loaded)
  const remove = useStripStore(s => s.remove)
  const reorder = useStripStore(s => s.reorder)
  const duplicate = useStripStore(s => s.duplicate)
  const tiras = useTiraStore(s => s.tiras)
  const saveTira = useTiraStore(s => s.save)
  const removeTira = useTiraStore(s => s.remove)
  const createTira = useTiraStore(s => s.create)
  const ensureDefault = useTiraStore(s => s.ensureDefault)
  const copyStrip = useClipboardStore(s => s.copy)
  const authors = useAuthorStore(s => s.authors)
  const projects = useProjectStore(s => s.projects)
  const scopedStrips = strips.filter(s => s.projectId === projectId)
  const scopedTiras = tiras.filter(t => t.projectId === projectId)

  // Tira "borrador" por defecto del proyecto.
  useEffect(() => { ensureDefault(projectId) }, [projectId, ensureDefault])
  // Viñetas dentro de alguna tira: "movidas" a subcarpeta → se ocultan de la lista
  // general (madre); solo se ven sueltas las libres.
  const inTiraIds = new Set(scopedTiras.flatMap(t => t.stripIds || []))
  const looseStrips = scopedStrips.filter(s => !inTiraIds.has(s.id))
  const hasAnyResult = scopedStrips.some(s => (s.results || []).length)
  const author = project?.authorId ? (authors.find(a => a.id === project.authorId) || null) : null

  const [dragIdx, setDragIdx] = useState(null)
  const [insertIdx, setInsertIdx] = useState(null)
  const [gallery, setGallery] = useState(null)
  const [openTiraId, setOpenTiraId] = useState(null)
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
    const n = scopedTiras.length + 1
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

  if (!loaded) return <div style={{ color: 'var(--color-text-muted)', padding: 24 }}>cargando...</div>

  if (openTira) {
    return (
      <TiraView
        tira={openTira}
        strips={scopedStrips}
        project={project}
        authors={authors}
        onBack={() => setOpenTiraId(null)}
        onOpenStrip={(strip) => onEdit(strip)}
        asCards
      />
    )
  }

  return (
    <ChatLayout>
      <div>
        <div className="section-header" style={{ justifyContent: 'space-between' }}>
          <h1 className="ui-h1">viñetas</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span
              onClick={openGallery}
              title={hasAnyResult ? 'ver todos los resultados en galería' : 'sin resultados para ver'}
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: hasAnyResult ? 'var(--color-text)' : 'var(--color-text-muted)',
                cursor: hasAnyResult ? 'pointer' : 'default',
                userSelect: 'none',
              }}
            >
              ver
            </span>
            <button className="btn btn-primary" onClick={onNew}>nueva viñeta</button>
            <button className="btn" onClick={newTira} title="crear una tira: carpeta que reúne viñetas">nueva tira</button>
          </div>
        </div>

      {/* Sección de tiras (carpetas de viñetas) */}
      {scopedTiras.length > 0 && (
        <div style={{ margin: '0 0 24px' }}>
          <div className="label" style={{ marginBottom: 8 }}>tiras</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
            {scopedTiras.map(t => (
              <div key={t.id} style={{ position: 'relative' }}>
                <TiraCard
                  tira={t}
                  strips={scopedStrips}
                  onOpen={() => setOpenTiraId(t.id)}
                  onAddStrip={(stripId) => addStripToTira(t.id, stripId)}
                  editing={editingTiraId === t.id}
                  onDone={(title) => { saveTira({ ...t, title }); setEditingTiraId(null) }}
                  onTogglePreview={(tiraId) => { const tt = tiras.find(x => x.id === tiraId); if (tt) saveTira({ ...tt, showInPreview: !tt.showInPreview }) }}
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
              onOpen={(s) => onEdit(s)}
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
      {gallery && (
        <GalleryPreview items={gallery} author={author} onClose={() => setGallery(null)} />
      )}
      </div>
    </ChatLayout>
  )
}
