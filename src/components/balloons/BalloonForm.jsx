import { useState } from 'react'
import useBalloonStore from '../../store/balloonStore'
import useProjectStore from '../../store/projectStore'
import { BALLOON_LAWS, BALLOON_LAW_GROUPS, makeDefaultBalloonLaws, balloonLawsToPrompt } from '../../data/balloonLaws'
import { projectStyleText } from '../../services/promptGenerator'
import SpellCheckedTextarea from '../SpellCheckedTextarea'
import ReferenceImagePicker from '../ReferenceImagePicker'
import PaletteEditor from '../projects/PaletteEditor'
import useAutoSaveBack from '../../utils/useAutoSaveBack'
import FormShade from '../FormShade'
import ChatLayout from '../chat/ChatLayout'

const KIND_OPTIONS = [
  { id: 'speech', label: 'diálogo' },
  { id: 'thought', label: 'pensamiento' },
  { id: 'narration', label: 'narración' },
  { id: 'other', label: 'globo x / cartela' },
  { id: 'image', label: 'globo de imagen' },
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

export default function BalloonForm({ balloon, projectId, onCancel }) {
  const save = useBalloonStore(s => s.save)
  const remove = useBalloonStore(s => s.remove)
  const balloons = useBalloonStore(s => s.balloons)
  const project = useProjectStore(s => s.projects.find(p => p.id === projectId)) || null
  const isNew = !balloon?.id

  const [name, setName] = useState(balloon?.name || '')
  const [kind, setKind] = useState(balloon?.kind || 'speech')
  const [color, setColor] = useState(balloon?.color || '#7a7a7a')
  const [text, setText] = useState(balloon?.text || '')
  const [promptText, setPromptText] = useState(balloon?.promptText || '')
  const [referenceImages, setReferenceImages] = useState(balloon?.referenceImages || [])
  const [laws, setLaws] = useState({ ...makeDefaultBalloonLaws(), ...(balloon?.laws || {}) })
  const [imageStyle, setImageStyle] = useState(balloon?.imageStyle || '')
  const [imagePalette, setImagePalette] = useState(balloon?.imagePalette || [])
  const [imageColorMode, setImageColorMode] = useState(balloon?.imageColorMode || project?.colorMode || 'bw')
  const [imagePaletteId, setImagePaletteId] = useState(balloon?.imagePaletteId || null)
  const [inheritStyle, setInheritStyle] = useState(balloon?.inheritStyle ?? !(balloon?.imageStyle))
  const [inheritPalette, setInheritPalette] = useState(balloon?.inheritPalette ?? !((balloon?.imagePalette || []).length))
  const [saving, setSaving] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const [savedId, setSavedId] = useState(balloon?.id || null)
  const draftId = savedId || balloon?.id || 'draft-balloon'

  const isImage = kind === 'image'
  const setLaw = (id, value) => setLaws(prev => ({ ...prev, [id]: value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    const updated = await save(payload())
    setSavedId(updated.id)
    setSaving(false)
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 2000)
  }

  const payload = () => ({
    ...balloon,
    id: savedId || crypto.randomUUID(),
    projectId: balloon?.projectId || projectId,
    name, kind, color, text, promptText, referenceImages, laws,
    imageStyle, imagePalette, imageColorMode, imagePaletteId, inheritStyle, inheritPalette,
  })
  const { goBack } = useAutoSaveBack({
    save,
    remove,
    payload,
    fields: ['name', 'kind', 'color', 'text', 'promptText', 'referenceImages', 'laws', 'imageStyle', 'imagePalette', 'imageColorMode', 'imagePaletteId', 'inheritStyle', 'inheritPalette'],
    hasContent: !!name.trim(),
    getStored: (id) => balloons.find(b => b.id === id) || null,
    onBack: onCancel,
  })

  const projectStyle = projectStyleText(project)
  const preview = balloonLawsToPrompt(laws)

  return (
    <ChatLayout>
      <div style={{ maxWidth: 560 }}>
        <div className="section-header">
          <button className="back-arrow" onClick={goBack} title="volver">←</button>
          <h1 className="ui-h1">
            {isNew ? 'nuevo globo' : 'editar globo'}
          </h1>
        </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <label className="label">nombre</label>
          <input
            className="input"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="globo de diálogo Crumb"
            autoFocus
          />
        </div>

        <FormShade active={!!name.trim()} hint="colocá un nombre para poder editar el resto">
        <div>
          <label className="label">tipo</label>
          <select className="input" value={kind} onChange={e => setKind(e.target.value)} style={{ cursor: 'pointer' }}>
            {KIND_OPTIONS.map(k => <option key={k.id} value={k.id}>{k.label}</option>)}
          </select>
          {isImage && (
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
              globo de imagen: lleva una imagen en su interior, no texto.
            </div>
          )}
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

        {!isImage ? (
          <div>
            <label className="label">texto por defecto (opcional)</label>
            <SpellCheckedTextarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="texto que llevaría este globo por defecto (se sobrescribe con el texto de cada panel)..."
              minRows={2}
            />
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
              el texto se escribe en cada panel como hasta ahora; este campo solo se usa como default si el panel no tiene texto.
            </div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
              la escena que va dentro se describe en cada panel, al tocar el globo y asignarle esta categoría.
            </div>
          </div>
        )}

        <div>
          <label className="label">{isImage ? 'prompt del marco' : 'descripción del globo'}</label>
          <SpellCheckedTextarea
            value={promptText}
            onChange={e => setPromptText(e.target.value)}
            placeholder={isImage ? 'describe el marco del globo: forma, contorno, cola, textura...' : 'describe el estilo del globo: forma, contorno, cola, lettering...'}
            minRows={4}
          />
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
            {isImage
              ? 'va al prompt como descripción del marco del globo de imagen.'
              : 'va al prompt como descripción del estilo, igual que el prompt del personaje.'}
          </div>
        </div>

        <ReferenceImagePicker entityId={draftId} entityName={name} value={referenceImages} onChange={setReferenceImages} />

        {isImage ? (
          <>
            <div className="card" style={{ padding: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                <label className="label" style={{ marginBottom: 0 }}>estilo de la imagen</label>
                <div className="radio-group" style={{ flexShrink: 0 }}>
                  <span
                    className={`radio-pill ${inheritStyle ? 'active' : ''}`}
                    style={{ fontSize: 11, cursor: 'pointer' }}
                    onClick={() => setInheritStyle(true)}
                    title="la imagen usa el estilo general del proyecto"
                  >
                    heredar
                  </span>
                  <span
                    className={`radio-pill ${!inheritStyle ? 'active' : ''}`}
                    style={{ fontSize: 11, cursor: 'pointer' }}
                    onClick={() => setInheritStyle(false)}
                    title="escribir un estilo propio para esta imagen"
                  >
                    escribir uno
                  </span>
                </div>
              </div>
              {inheritStyle ? (
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                  {projectStyle
                    ? `la imagen usa el estilo del proyecto: ${projectStyle}`
                    : 'el proyecto no tiene estilo definido; escribí uno propio.'}
                </div>
              ) : (
                <SpellCheckedTextarea
                  value={imageStyle}
                  onChange={e => setImageStyle(e.target.value)}
                  placeholder="estilo propio de la imagen que va dentro del globo..."
                  minRows={2}
                />
              )}
            </div>

            <div className="card" style={{ padding: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                <label className="label" style={{ marginBottom: 0 }}>paleta de la imagen</label>
                <div className="radio-group" style={{ flexShrink: 0 }}>
                  <span
                    className={`radio-pill ${inheritPalette ? 'active' : ''}`}
                    style={{ fontSize: 11, cursor: 'pointer' }}
                    onClick={() => setInheritPalette(true)}
                    title="la imagen usa la paleta del proyecto"
                  >
                    heredar
                  </span>
                  <span
                    className={`radio-pill ${!inheritPalette ? 'active' : ''}`}
                    style={{ fontSize: 11, cursor: 'pointer' }}
                    onClick={() => setInheritPalette(false)}
                    title="usar otra paleta para esta imagen"
                  >
                    usar otra
                  </span>
                </div>
              </div>
              {inheritPalette ? (
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                  la imagen usa la paleta del proyecto ({project?.colorMode === 'bw' ? 'B&N' : (project?.colorMode || '') || 'sin paleta'}).
                </div>
              ) : (
                <PaletteEditor
                  colors={imagePalette}
                  colorMode={imageColorMode}
                  onModeChange={setImageColorMode}
                  onColorsChange={setImagePalette}
                  paletteId={imagePaletteId}
                  onPaletteIdChange={setImagePaletteId}
                />
              )}
            </div>
          </>
        ) : (
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
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" className="btn btn-primary" disabled={saving || !name.trim()}>
            {saving ? 'guardando...' : savedFlash ? 'guardado ✓' : 'guardar'}
          </button>
        </div>
        </FormShade>
      </form>
      </div>
    </ChatLayout>
  )
}