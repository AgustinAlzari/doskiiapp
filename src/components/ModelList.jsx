import { useState, useEffect } from 'react'
import useChatStore from '../store/chatStore'
import { askConfirm } from '../store/confirmStore'
import ChatLayout from './chat/ChatLayout'
import { getMuseSecrets, setMuseSecrets } from '../services/museSecrets'
import ModelPicker from './models/ModelPicker'
import useMuseUiStore from '../store/museUiStore'

export default function ModelList() {
  const models = useChatStore(s => s.models)
  const favoriteModelId = useChatStore(s => s.favoriteModelId)
  const setFavorite = useChatStore(s => s.setFavorite)
  const addModel = useChatStore(s => s.addModel)
  const removeModel = useChatStore(s => s.removeModel)

  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [museKey, setMuseKey] = useState(() => getMuseSecrets().apiKey)
  const [museProvider, setMuseProvider] = useState(() => getMuseSecrets().provider)
  const museModel = useMuseUiStore(s => s.selectedModel)
  const setMuseModel = useMuseUiStore(s => s.setModel)

  const handleAdd = (e) => {
    e.preventDefault()
    const added = addModel({ name: name.toLowerCase(), url })
    if (added) {
      setFavorite(added.id)
      setName('')
      setUrl('')
    }
  }

  const normalizeUrl = (u) => {
    const clean = String(u || '').trim()
    return clean && !/^https?:\/\//i.test(clean) ? `https://${clean}` : clean
  }

  return (
    <ChatLayout>
      <div style={{ maxWidth: 560 }}>
        <div className="section-header" style={{ justifyContent: 'space-between' }}>
          <h1 className="ui-h1">modelos</h1>
        </div>

        {/* Muse API — localStorage MVP */}
        <div className="card" style={{ padding: 16, marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>muse api — image_generation</div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>mvp guarda en localStorage. escalado futuro: safeStorage por autor (ver plan-lab1 §4.1).</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <select className="input" value={museProvider} onChange={e => setMuseProvider(e.target.value)} style={{ height: 28, fontSize: 12 }}>
              <option value="meta">meta</option>
              <option value="zen">zen (opencode)</option>
            </select>
            <input className="input" type="password" style={{ flex: 1, minWidth: 220 }} value={museKey} onChange={e => setMuseKey(e.target.value)} placeholder="MODEL_API_KEY (LLM|...)" />
            <button className="btn btn-sm" onClick={() => { setMuseSecrets({ provider: museProvider, apiKey: museKey }); alert(museKey ? 'key guardada ✓' : 'key borrada') }}>guardar</button>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>modelo</span>
            <div style={{ flex: 1, minWidth: 220 }}><ModelPicker value={museModel} onChange={setMuseModel} filter="image" /></div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>👁️ = puede ver (vision). solo image_generation para mvp.</div>
        </div>

      {/* Nuevo modelo */}
      <form className="card" style={{ padding: 16, marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 12 }} onSubmit={handleAdd}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>nuevo modelo de IA</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            className="input"
            style={{ flex: 1, minWidth: 120 }}
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="nombre (ej. Perplexity)"
          />
          <input
            className="input"
            style={{ flex: 1.4, minWidth: 180 }}
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://..."
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-primary btn-sm" type="submit" disabled={!name.trim() || !url.trim()}>
            agregar
          </button>
        </div>
      </form>

      {/* Modelos cargados */}
      {models.length === 0 ? (
        <div style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>sin modelos. agregá uno arriba.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {models.map(m => (
            <div key={m.id} className="card" style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setFavorite(m.id)}
                title={favoriteModelId === m.id ? 'favorito' : 'marcar como favorito'}
                style={{ fontSize: 15, padding: '2px 8px' }}
              >
                {favoriteModelId === m.id ? '★' : '☆'}
              </button>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{String(m.name).toLowerCase()}</div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.url}</div>
              </div>
              <div style={{ flex: 1 }} />
              <button
                className="btn btn-ghost btn-sm btn-danger"
                onClick={async () => { if (await askConfirm(`¿eliminar "${String(m.name).toLowerCase()}"?`, { confirmLabel: 'borrar' })) removeModel(m.id) }}
                disabled={models.length <= 1}
                style={{ fontSize: 12 }}
                title={models.length <= 1 ? 'no se puede eliminar el último modelo' : 'eliminar'}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 12 }}>
        el favorito (★) es el que se abre en el chat de la vista prompts. por defecto: chatgpt.
      </div>
      </div>
    </ChatLayout>
  )
}
