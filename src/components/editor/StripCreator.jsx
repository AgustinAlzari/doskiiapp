import { useState } from 'react'
import useStripStore from '../../store/stripStore'
import ChatLayout from '../chat/ChatLayout'
import { ASPECT_RATIOS } from '../../data/actionPresets'
export default function StripCreator({ project, onCreated, onBack }) {
  const save = useStripStore(s => s.save)
  const [title, setTitle] = useState('')
  const [panelCount, setPanelCount] = useState(project?.defaultPanelCount || 1)
  const [aspectRatio, setAspectRatio] = useState(project?.defaultAspectRatio || 'hd')

  const handleCreate = async () => {
    if (!title.trim()) return
    const panels = Array.from({ length: panelCount }, (_, i) => ({
      id: crypto.randomUUID(),
      scene: '',
      characters: [],
      backgroundId: null,
      objects: [],
      narration: null,
    }))
    const strip = {
      id: crypto.randomUUID(),
      projectId: project?.id,
      title,
      panelCount,
      aspectRatio,
      panels,
      createdAt: new Date().toISOString(),
    }
    await save(strip)
    onCreated(strip)
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
          <label className="label">cantidad de cuadros</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <input
              type="number"
              className="input"
              value={panelCount}
              onChange={e => setPanelCount(Math.max(1, Math.min(12, parseInt(e.target.value) || 1)))}
              min={1}
              max={12}
              style={{ width: 80 }}
            />
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>máx. 12</span>
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
        </div>

        <button className="btn btn-primary" onClick={handleCreate} disabled={!title.trim()}>
          crear
        </button>
      </div>
      </div>
    </ChatLayout>
  )
}
