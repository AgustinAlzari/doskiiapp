import { useMemo, useState } from 'react'
import useStripStore from '../../store/stripStore'
import useTiraStore from '../../store/tiraStore'
import { confirmDelete } from '../../utils/confirmDelete'
import ChatLayout from '../chat/ChatLayout'
import { ASPECT_RATIOS } from '../../data/actionPresets'

const GENERAL = '__general__'

export default function StripCreator({ project, onCreated, onBack }) {
  const save = useStripStore(s => s.save)
  const strips = useStripStore(s => s.strips)
  const tiras = useTiraStore(s => s.tiras)
  const saveTira = useTiraStore(s => s.save)
  const removeTira = useTiraStore(s => s.remove)
  const createTira = useTiraStore(s => s.create)
  const [title, setTitle] = useState('')
  const [tiraId, setTiraId] = useState(GENERAL)
  const [aspectRatio, setAspectRatio] = useState(project?.defaultAspectRatio || 'hd')

  const scopedTiras = tiras.filter(t => t.projectId === project?.id)
  const scopedStrips = strips.filter(s => s.projectId === project?.id)
  const inTiraIds = new Set(scopedTiras.flatMap(t => t.stripIds || []))
  const looseStrips = scopedStrips.filter(s => !inTiraIds.has(s.id))

  // Formato de la primera viñeta de la tira elegida (para general, la primera
  // viñeta suelta). Si la tira está vacía, usa el formato del proyecto.
  const firstStripAspectRatio = useMemo(() => {
    if (tiraId === GENERAL) {
      const first = looseStrips[0]
      return first?.aspectRatio || project?.defaultAspectRatio || 'hd'
    }
    const tira = scopedTiras.find(t => t.id === tiraId)
    const firstId = (tira?.stripIds || [])[0]
    const first = scopedStrips.find(s => s.id === firstId)
    return first?.aspectRatio || project?.defaultAspectRatio || 'hd'
  }, [tiraId, looseStrips, scopedTiras, scopedStrips, project?.defaultAspectRatio])

  // Al cambiar de tira, pre-cargar el formato compartido de esa tira.
  const chooseTira = (id) => {
    setTiraId(id)
    const next = id === GENERAL
      ? (looseStrips[0]?.aspectRatio || project?.defaultAspectRatio || 'hd')
      : (() => {
          const t = scopedTiras.find(x => x.id === id)
          const first = scopedStrips.find(s => s.id === (t?.stripIds || [])[0])
          return first?.aspectRatio || project?.defaultAspectRatio || 'hd'
        })()
    setAspectRatio(next)
  }

  const newTira = async () => {
    const n = scopedTiras.length + 1
    const t = await createTira(project?.id, `tira ${n}`)
    chooseTira(t.id)
  }

  const deleteTira = async (id) => {
    const t = tiras.find(x => x.id === id)
    if (!t) return
    if (!(await confirmDelete(t.title || 'tira', false))) return
    await removeTira(id)
    if (tiraId === id) setTiraId(GENERAL)
  }

  const handleCreate = async () => {
    if (!title.trim()) return
    const strip = {
      id: crypto.randomUUID(),
      projectId: project?.id,
      title,
      panelCount: 1,
      aspectRatio,
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
    await save(strip)
    const destTiraId = tiraId !== GENERAL ? tiraId : null
    if (destTiraId) {
      const t = tiras.find(x => x.id === destTiraId)
      if (t) await saveTira({ ...t, stripIds: [...(t.stripIds || []), strip.id] })
    }
    onCreated(strip, destTiraId)
  }

  return (
    <ChatLayout>
      <div style={{ maxWidth: 480 }}>
        <div className="section-header">
          <button className="back-arrow" onClick={onBack} title="volver">←</button>
          <h1 className="ui-h1">nueva viñeta</h1>
        </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <label className="label">título</label>
          <input
            className="input"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="La rana"
            autoFocus
          />
        </div>

        <div>
          <label className="label">tira</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <select className="input" style={{ flex: 1 }} value={tiraId} onChange={e => chooseTira(e.target.value)} title="a qué tira pertenece la viñeta">
              <option value={GENERAL}>general</option>
              {scopedTiras.map(t => <option key={t.id} value={t.id}>{t.title || 'sin título'}</option>)}
            </select>
            <button className="btn" onClick={newTira} title="crear una tira">+</button>
            {tiraId !== GENERAL && (
              <button className="btn" onClick={() => deleteTira(tiraId)} title="borrar la tira">×</button>
            )}
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
            el formato se comparte con la primera viñeta de la tira (cambiable acá o en el editor)
          </div>
        </div>

        <div>
          <label className="label">proporción</label>
          {['formato', 'ig'].map(group => {
            const items = ASPECT_RATIOS.filter(ar => (ar.group || 'formato') === group)
            if (!items.length) return null
            return (
              <div key={group} style={{ marginBottom: 10 }}>
                {group === 'ig' && (
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 4 }}>
                    instagram
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {items.map(ar => {
                    const [w, h] = ar.css.split('/').map(Number)
                    const previewW = 40
                    const previewH = previewW * (h / w)
                    const hasRatio = ar.label.includes(ar.ratio)
                    return (
                      <div
                        key={ar.id}
                        onClick={() => setAspectRatio(ar.id)}
                        title={ar.desc}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 4,
                          cursor: 'pointer',
                          padding: 8,
                          borderRadius: 'var(--radius-md)',
                          border: aspectRatio === ar.id ? '2px solid var(--color-accent)' : '2px solid var(--color-border)',
                          transition: 'all 0.1s ease',
                          minWidth: 72,
                        }}
                      >
                        <div style={{
                          width: previewW,
                          height: Math.min(previewH, 48),
                          border: '1.5px solid var(--color-text-muted)',
                          borderRadius: 3,
                          background: aspectRatio === ar.id ? 'var(--color-accent)' : 'transparent',
                          borderColor: aspectRatio === ar.id ? 'var(--color-accent)' : 'var(--color-text-muted)',
                        }} />
                        <span style={{ fontSize: 11, fontWeight: aspectRatio === ar.id ? 600 : 400, color: aspectRatio === ar.id ? 'var(--color-accent)' : 'var(--color-text-muted)' }}>
                          {ar.label}
                        </span>
                        {!hasRatio && <span style={{ fontSize: 9, color: 'var(--color-text-muted)' }}>{ar.ratio}</span>}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
          {firstStripAspectRatio && aspectRatio === firstStripAspectRatio && (
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
              formato de la tira
            </div>
          )}
        </div>

        <button className="btn btn-primary" onClick={handleCreate} disabled={!title.trim()}>
          crear
        </button>
      </div>
      </div>
    </ChatLayout>
  )
}