import { useState } from 'react'
import useChatStore from '../store/chatStore'

export default function ModelList() {
  const models = useChatStore(s => s.models)
  const favoriteModelId = useChatStore(s => s.favoriteModelId)
  const setFavorite = useChatStore(s => s.setFavorite)
  const addModel = useChatStore(s => s.addModel)
  const removeModel = useChatStore(s => s.removeModel)

  const [name, setName] = useState('')
  const [url, setUrl] = useState('')

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
    <div style={{ maxWidth: 560 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 className="ui-h1">modelos</h1>
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
                onClick={() => { if (confirm(`¿Eliminar "${String(m.name).toLowerCase()}"?`)) removeModel(m.id) }}
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
  )
}
