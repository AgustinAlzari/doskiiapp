import { useEffect, useState } from 'react'
import useStripStore from '../store/stripStore'
import useAuthorStore from '../store/authorStore'
import useProjectStore from '../store/projectStore'
import { confirmDelete, isInCloud } from '../utils/confirmDelete'
import GalleryPreview from './GalleryPreview'
import ChatLayout from './chat/ChatLayout'

function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
  const day = d.getDate()
  const month = months[d.getMonth()]
  const year = d.getFullYear()
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${day} ${month} ${year}, ${h}:${m}`
}

function StripCover({ strip }) {
  const [src, setSrc] = useState(null)
  const result = strip.results?.[strip.resultCoverIndex]
  useEffect(() => {
    let active = true
    if (result?.path && window.api?.references) {
      window.api.references.read(result.path).then(url => { if (active) setSrc(url) })
    } else setSrc(null)
    return () => { active = false }
  }, [result?.path])

  if (!src) return null
  return (
    <div style={{ height: 120, border: '1px solid var(--color-border)', borderRadius: 6, overflow: 'hidden', marginBottom: 8, background: 'white' }}>
      <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
    </div>
  )
}

export default function StripList({ project, projectId, onNew, onEdit }) {
  const strips = useStripStore(s => s.strips)
  const loaded = useStripStore(s => s.loaded)
  const remove = useStripStore(s => s.remove)
  const reorder = useStripStore(s => s.reorder)
  const authors = useAuthorStore(s => s.authors)
  const projects = useProjectStore(s => s.projects)
  const scopedStrips = strips.filter(s => s.projectId === projectId)
  const hasAnyResult = scopedStrips.some(s => (s.results || []).length)
  const author = project?.authorId ? (authors.find(a => a.id === project.authorId) || null) : null

  const [dragIdx, setDragIdx] = useState(null)
  const [insertIdx, setInsertIdx] = useState(null)
  const [gallery, setGallery] = useState(null)

  // Galería de todos los resultados del proyecto en el orden de la lista de viñetas.
  const openGallery = async () => {
    if (!window.api?.references) return
    const items = []
    for (const s of scopedStrips) {
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
    setDragIdx(idx)
    setInsertIdx(null)
    e.dataTransfer.effectAllowed = 'move'
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
      const next = [...scopedStrips]
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
          </div>
        </div>

      {scopedStrips.length === 0 ? (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '64px 24px',
          gap: 16,
        }}>
          <div style={{ color: 'var(--color-text-muted)', fontSize: 14, textAlign: 'center' }}>
            sin viñetas aún. creá una para empezar.
          </div>
          <button className="btn btn-primary" onClick={onNew}>nueva viñeta</button>
        </div>
      ) : (
        <div className="strip-grid">
          {scopedStrips.map((strip, idx) => (
            <div
              key={strip.id}
              draggable
              onDragStart={e => onDragStart(e, idx)}
              onDragOver={e => onDragOver(e, idx)}
              onDrop={e => onDrop(e, idx)}
              onDragEnd={onDragEnd}
              className="strip-card"
              style={{
                position: 'relative',
                cursor: 'grab',
                opacity: dragIdx === idx ? 0.4 : 1,
              }}
              onClick={() => onEdit(strip)}
            >
              {/* Línea de inserción en el espacio entre tarjetas */}
              {dragIdx != null && insertIdx === idx && (
                <span style={{ position: 'absolute', left: -8, top: 0, bottom: 0, width: 3, background: 'var(--color-accent)', borderRadius: 2, zIndex: 3 }} />
              )}
              {dragIdx != null && insertIdx === idx + 1 && (
                <span style={{ position: 'absolute', right: -8, top: 0, bottom: 0, width: 3, background: 'var(--color-accent)', borderRadius: 2, zIndex: 3 }} />
              )}
              <StripCover strip={strip} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <div className="ui-h3" style={{ flex: 1, minWidth: 0 }}>
                  {strip.title || 'sin título'}
                </div>
                <button
                  className="btn btn-ghost btn-sm btn-danger"
                  style={{ flexShrink: 0 }}
                  onClick={(e) => { e.stopPropagation(); if (confirmDelete(strip.title || 'viñeta', isInCloud(strip, projects))) remove(strip.id) }}
                >
                  ×
                </button>
              </div>

              {strip.generalStyle && (
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
                  {strip.generalStyle}
                </div>
              )}

              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', lineHeight: 1.4, marginTop: 2 }}>
                {strip.createdAt && <span>creada {formatDate(strip.createdAt)}</span>}
                {strip.updatedAt && strip.updatedAt !== strip.createdAt && (
                  <span> · modif. {formatDate(strip.updatedAt)}</span>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: 8 }}>
                <div className="strip-card-dots">
                  {(strip.panels || []).slice(0, 10).map((p, i) => (
                    <div
                      key={p.id || i}
                      className={`strip-card-dot ${p.scene ? 'has-scene' : ''}`}
                      title={`cuadro ${i + 1}${p.scene ? ': ' + p.scene : ''}`}
                    />
                  ))}
                </div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                  {strip.panels?.length || 0} cuadros
                </div>
              </div>
            </div>
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
