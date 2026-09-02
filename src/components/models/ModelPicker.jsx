import { useEffect, useState } from 'react'
import { listModels } from '../../services/modelCatalog'
import { getMuseSecrets } from '../../services/museSecrets'

export default function ModelPicker({ value, onChange, filter = null }) {
  const [models, setModels] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    const load = async () => {
      setLoading(true)
      const { apiKey, provider } = getMuseSecrets()
      const list = await listModels({ metaKey: provider === 'meta' ? apiKey : '', zenKey: provider === 'zen' ? apiKey : apiKey })
      if (!alive) return
      // filter: 'image' | 'vision' | null
      let filtered = list
      if (filter === 'image') filtered = list.filter(m => m.capabilities.includes('image_generation'))
      if (filter === 'vision') filtered = list.filter(m => m.vision)
      setModels(filtered)
      setLoading(false)
      // auto-select first if value missing
      if (filtered.length && !filtered.some(m => m.id === value)) {
        // no auto-change, dejar que padre decida; solo si value vacío
        if (!value) onChange?.(filtered[0].id)
      }
    }
    load()
    return () => { alive = false }
  }, [])

  if (loading) return <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>cargando modelos...</div>

  return (
    <select className="input" value={value || ''} onChange={e => onChange?.(e.target.value)} style={{ height: 28, fontSize: 12 }}>
      {models.map(m => (
        <option key={`${m.provider}:${m.id}`} value={m.id}>
          {String(m.id).toLowerCase()} {m.vision ? '👁️' : ''} {m.free ? '(gratis)' : ''} {m.provider === 'zen' ? '[zen]' : ''} {m.cost ? `· ${m.cost}` : ''}
        </option>
      ))}
    </select>
  )
}
