import { useState } from 'react'
import useBalloonStore from '../../store/balloonStore'
import { BALLOON_LAWS, BALLOON_LAW_GROUPS, makeDefaultBalloonLaws, balloonLawsToPrompt } from '../../data/balloonLaws'
import AutoTextarea from '../editor/AutoTextarea'
import ReferenceImagePicker from '../ReferenceImagePicker'

const KIND_OPTIONS = [
  { id: 'speech', label: 'diálogo' },
  { id: 'thought', label: 'pensamiento' },
  { id: 'narration', label: 'narración' },
  { id: 'other', label: 'globo x / cartela' },
]

function LawControl({ law, value, onChange }) {
  if (law.control === 'check') {
    return (
      <label className="check-item">
        <div
          className={`check-box ${value ? 'checked' : ''}`}
          onClick={() => onChange(law.id, !value)}
        />
        <div style={{ fontSize: 12, lineHeight: 1.3 }}>
          <div>{law.labelES}</div>
          {law.hint && <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{law.hint}</div>}
        </div>
      </label>
    )
  }
  if (law.control === 'select') {
    return (
      <div>
        <label className="label">{law.labelES}</label>
        <select className="input" value={value} onChange={e => onChange(law.id, e.target.value)} style={{ cursor: 'pointer' }}>
          {law.options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
      </div>
    )
  }
  if (law.control === 'multi') {
    const arr = Array.isArray(value) ? value : []
    return (
      <div>
        <label className="label">{law.labelES}</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {law.options.map(opt => {
            const active = arr.includes(opt.value)
            return (
              <span
                key={opt.value}
                className={`radio-pill ${active ? 'active' : ''}`}
                style={{ fontSize: 11, cursor: 'pointer' }}
                onClick={() => onChange(law.id, active ? arr.filter(v => v !== opt.value) : [...arr, opt.value])}
              >
                {opt.label}
              </span>
            )
          })}
        </div>
      </div>
    )
  }
  return null
}

export default function BalloonForm({ balloon, projectId, onSaved, onCancel }) {
  const save = useBalloonStore(s => s.save)
  const isNew = !balloon?.id

  const [name, setName] = useState(balloon?.name || '')
  const [kind, setKind] = useState(balloon?.kind || 'speech')
  const [color, setColor] = useState(balloon?.color || '#7a7a7a')
  const [text, setText] = useState(balloon?.text || '')
  const [promptText, setPromptText] = useState(balloon?.promptText || '')
  const [referenceImages, setReferenceImages] = useState(balloon?.referenceImages || [])
  const [laws, setLaws] = useState({ ...makeDefaultBalloonLaws(), ...(balloon?.laws || {}) })
  const [saving, setSaving] = useState(false)
  const draftId = balloon?.id || 'draft-balloon'

  const setLaw = (id, value) => setLaws(prev => ({ ...prev, [id]: value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    await save({ ...balloon, id: balloon?.id || crypto.randomUUID(), projectId: balloon?.projectId || projectId, name, kind, color, text, promptText, referenceImages, laws })
    setSaving(false)
    onSaved()
  }

  const preview = balloonLawsToPrompt(laws)

  return (
    <div style={{ maxWidth: 560 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button className="back-arrow" onClick={onCancel} title="volver">←</button>
        <h1 className="ui-h1">
          {isNew ? 'nuevo globo' : 'editar globo'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label className="label">nombre</label>
            <input
              className="input"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="globo de diálogo Crumb"
              autoFocus
            />
          </div>
          <div style={{ flex: 1 }}>
            <label className="label">tipo</label>
            <select className="input" value={kind} onChange={e => setKind(e.target.value)} style={{ cursor: 'pointer' }}>
              {KIND_OPTIONS.map(k => <option key={k.id} value={k.id}>{k.label}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="label">color de identificación</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <input
              type="color"
              value={color}
              onChange={e => setColor(e.target.value)}
              style={{ width: 32, height: 32, border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', cursor: 'pointer', padding: 2 }}
            />
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{color}</span>
          </div>
        </div>

        <div>
          <label className="label">texto por defecto (opcional)</label>
          <AutoTextarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="texto que llevaría este globo por defecto (se sobrescribe con el texto de cada panel)..."
            minRows={2}
          />
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
            el texto se escribe en cada panel como hasta ahora; este campo solo se usa como default si el panel no tiene texto.
          </div>
        </div>

        <div>
          <label className="label">descripción del globo</label>
          <AutoTextarea
            value={promptText}
            onChange={e => setPromptText(e.target.value)}
            placeholder="describe el estilo del globo: forma, contorno, cola, lettering..."
            minRows={4}
          />
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
            va al prompt como descripción del estilo, igual que el prompt del personaje.
          </div>
        </div>

        <ReferenceImagePicker entityId={draftId} entityName={name} value={referenceImages} onChange={setReferenceImages} />

        {/* Leyes */}
        <div className="card" style={{ padding: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <label className="label" style={{ marginBottom: 0 }}>restricciones (leyes de rotulación)</label>
            <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{preview.length} activas</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {BALLOON_LAW_GROUPS.map(group => {
              const lawsOfGroup = BALLOON_LAWS.filter(l => l.group === group.id)
              return (
                <details key={group.id} open>
                  <summary style={{ cursor: 'pointer', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                    {group.label} <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>— {group.hint}</span>
                  </summary>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 4 }}>
                    {lawsOfGroup.map(law => (
                      <LawControl key={law.id} law={law} value={laws[law.id] ?? law.default} onChange={setLaw} />
                    ))}
                  </div>
                </details>
              )
            })}
          </div>
          {preview.length > 0 && (
            <div style={{ marginTop: 10, fontSize: 11, lineHeight: 1.5, color: 'var(--color-text-2)', background: 'var(--color-surface)', border: '1px solid var(--color-border-muted)', borderRadius: 6, padding: 8 }}>
              <div style={{ fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 4 }}>preview del prompt (EN)</div>
              {preview.map((s, i) => <div key={i}>· {s}</div>)}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" className="btn btn-primary" disabled={saving || !name.trim()}>
            {saving ? 'guardando...' : 'guardar'}
          </button>
        </div>
      </form>
    </div>
  )
}
