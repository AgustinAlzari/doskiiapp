import { useState } from 'react'
import useProjectStore, { BALLOON_TYPES } from '../../store/projectStore'
import AutoTextarea from '../editor/AutoTextarea'
import PaletteEditor from './PaletteEditor'
import ReferenceImagePicker from '../ReferenceImagePicker'
import { ASPECT_RATIOS } from '../../data/actionPresets'

export default function ProjectForm({ project, onBack, onProjectChanged, onDeleted }) {
  const save = useProjectStore(s => s.save)
  const duplicate = useProjectStore(s => s.duplicate)
  const removeAll = useProjectStore(s => s.removeAll)
  const isNew = !project?.id

  const [name, setName] = useState(project?.name || '')
  const [synopsis, setSynopsis] = useState(project?.synopsis || '')
  const [genre, setGenre] = useState(project?.genre || '')
  const [drawingStyle, setDrawingStyle] = useState(project?.drawingStyle || '')
  const [world, setWorld] = useState(project?.world || '')
  const [styleNotes, setStyleNotes] = useState(project?.styleNotes || '')
  const [defaultAspectRatio, setDefaultAspectRatio] = useState(project?.defaultAspectRatio || 'hd')
  const [defaultPanelCount, setDefaultPanelCount] = useState(project?.defaultPanelCount || 3)
  const [colorMode, setColorMode] = useState(project?.colorMode || 'bw')
  const [palette, setPalette] = useState(project?.palette || [])
  const [balloons, setBalloons] = useState(project?.balloons || {
    narration: { description: '' },
    speech: { description: '' },
    thought: { description: '' },
  })
  const [saving, setSaving] = useState(false)

  const collect = () => ({
    ...project,
    id: project?.id || crypto.randomUUID(),
    name,
    synopsis,
    genre,
    drawingStyle,
    world,
    styleNotes,
    defaultAspectRatio,
    defaultPanelCount,
    colorMode,
    palette,
    balloons,
  })

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    const saved = await save(collect())
    setSaving(false)
    onProjectChanged(saved)
  }

  const handleDuplicate = async () => {
    if (!project?.id) return
    setSaving(true)
    await save(collect())
    const copy = await duplicate(project.id)
    setSaving(false)
    onProjectChanged(copy)
  }

  const handleExport = async () => {
    if (!project?.id) return
    await save(collect())
    if (!window.api?.projects || !window.api?.dialog) return
    const result = await window.api.dialog.save({
      defaultPath: `${name.replace(/[^a-z0-9_-]+/gi, '_').toLowerCase() || 'proyecto'}.doski`,
      filters: [{ name: 'Proyecto doski', extensions: ['doski'] }],
    })
    if (!result.canceled && result.filePath) {
      await window.api.projects.export({ projectId: project.id, filePath: result.filePath })
    }
  }

  const handleDelete = async () => {
    if (!project?.id) return
    if (!confirm(`¿Eliminar el proyecto "${name}" y TODO su contenido (tiras, personajes, fondos, objetos)?`)) return
    await removeAll(project.id)
    onDeleted()
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}>
          {isNew ? 'nuevo proyecto' : 'proyecto'}
        </h1>
        <button className="btn btn-ghost" onClick={onBack}>← volver</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <label className="label">nombre</label>
          <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="La rana y la lluvia" autoFocus />
        </div>

        <div>
          <label className="label">sinopsis</label>
          <AutoTextarea value={synopsis} onChange={e => setSynopsis(e.target.value)} placeholder="de qué trata la serie..." minRows={2} />
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label className="label">género / tono</label>
            <input className="input" value={genre} onChange={e => setGenre(e.target.value)} placeholder="gag diario, absurdo nórdico..." />
          </div>
          <div style={{ flex: 1 }}>
            <label className="label">mundo / época</label>
            <input className="input" value={world} onChange={e => setWorld(e.target.value)} placeholder="suburbio años 70..." />
          </div>
        </div>

        <div>
          <label className="label">estilo de dibujo</label>
          <input className="input" value={drawingStyle} onChange={e => setDrawingStyle(e.target.value)} placeholder="Sempé, línea fina B&N, acuarela..." />
        </div>

        <div>
          <label className="label">notas de estilo</label>
          <AutoTextarea value={styleNotes} onChange={e => setStyleNotes(e.target.value)} placeholder="párrafo libre con la definición integral de la historieta..." minRows={3} />
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <div>
            <label className="label">proporción por defecto</label>
            <select className="input" value={defaultAspectRatio} onChange={e => setDefaultAspectRatio(e.target.value)} style={{ cursor: 'pointer' }}>
              {ASPECT_RATIOS.map(ar => <option key={ar.id} value={ar.id}>{ar.label} {ar.ratio}</option>)}
            </select>
          </div>
          <div>
            <label className="label">cuadros por defecto</label>
            <input
              type="number"
              className="input"
              value={defaultPanelCount}
              onChange={e => setDefaultPanelCount(Math.max(1, Math.min(12, parseInt(e.target.value) || 1)))}
              min={1}
              max={12}
              style={{ width: 80 }}
            />
          </div>
        </div>

        <div className="card" style={{ padding: 12 }}>
          <label className="label" style={{ marginBottom: 8 }}>paleta de colores</label>
          <PaletteEditor palette={palette} colorMode={colorMode} onModeChange={setColorMode} onPaletteChange={setPalette} />
        </div>

        <div className="card" style={{ padding: 12 }}>
          <label className="label" style={{ marginBottom: 8 }}>globos por tipo</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {BALLOON_TYPES.map(type => {
              const balloon = balloons[type.id] || { description: '' }
              const updateBalloon = (updates) => {
                setBalloons(prev => ({ ...prev, [type.id]: { ...balloon, ...updates } }))
              }
              return (
                <div key={type.id} style={{ border: '1px solid var(--color-border)', borderRadius: 6, padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>globo de {type.label}</span>
                  <AutoTextarea
                    value={balloon.description || ''}
                    onChange={e => updateBalloon({ description: e.target.value })}
                    placeholder={`descripción del globo de ${type.label}... (se incorpora siempre al prompt)`}
                    minRows={2}
                  />
                  <ReferenceImagePicker
                    entityId={`balloon-${project?.id || 'new'}-${type.id}`}
                    entityName={type.fileBase}
                    value={balloon.fileName && balloon.path ? [balloon] : []}
                    onChange={arr => updateBalloon({ fileName: arr[0]?.fileName, path: arr[0]?.path })}
                    label="imagen (opcional)"
                  />
                </div>
              )
            })}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? 'guardando...' : 'guardar'}
          </button>
          <button className="btn" onClick={handleDuplicate} disabled={!project?.id || saving}>duplicar</button>
          <button className="btn" onClick={handleExport} disabled={!project?.id || saving}>exportar .doski</button>
          {!isNew && (
            <button className="btn btn-ghost btn-danger" onClick={handleDelete} style={{ marginLeft: 'auto' }}>eliminar proyecto</button>
          )}
        </div>
      </div>
    </div>
  )
}
