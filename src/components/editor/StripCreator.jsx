import { useState } from 'react'
import useStripStore from '../../store/stripStore'
import AutoTextarea from './AutoTextarea'
import { ASPECT_RATIOS } from '../../data/actionPresets'

export default function StripCreator({ project, onCreated, onBack }) {
  const save = useStripStore(s => s.save)
  const [title, setTitle] = useState('')
  const [generalStyle, setGeneralStyle] = useState('')
  const [panelCount, setPanelCount] = useState(project?.defaultPanelCount || 3)
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
      generalStyle,
      panelCount,
      aspectRatio,
      panels,
      createdAt: new Date().toISOString(),
    }
    await save(strip)
    onCreated(strip)
  }

  return (
    <div style={{ maxWidth: 480 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}>nueva viñeta</h1>
        <button className="btn btn-ghost" onClick={onBack}>cancelar</button>
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
          <label className="label">estilo general</label>
          <AutoTextarea
            value={generalStyle}
            onChange={e => setGeneralStyle(e.target.value)}
            placeholder="describe el estilo visual: Estilo Sempé, línea fina B&N, humor nórdico..."
            minRows={3}
          />
          {project && (project.styleNotes || project.drawingStyle || project.genre) && (
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
              hereda del proyecto: {[project.drawingStyle, project.genre, project.styleNotes].filter(Boolean).join(' · ')}
              {generalStyle.trim() ? ' (este campo agrega o reemplaza)' : ''}
            </div>
          )}
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
          <div style={{ display: 'flex', gap: 8 }}>
            {ASPECT_RATIOS.map(ar => {
              const [w, h] = ar.css.split('/').map(Number)
              const previewW = 40
              const previewH = previewW * (h / w)
              return (
                <div
                  key={ar.id}
                  onClick={() => setAspectRatio(ar.id)}
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
                  <span style={{ fontSize: 9, color: 'var(--color-text-muted)' }}>{ar.ratio}</span>
                </div>
              )
            })}
          </div>
        </div>

        <button className="btn btn-primary" onClick={handleCreate} disabled={!title.trim()}>
          crear viñeta
        </button>
      </div>
    </div>
  )
}
