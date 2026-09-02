// modelCatalog.js — lista modelos meta + opencode zen, con flag vision (👁️) y free

const META_URL = 'https://api.meta.ai/v1/models'
const ZEN_URL = 'https://opencode.ai/zen/v1/models'

const FALLBACK = [
  { id: 'muse-image-1.0', provider: 'meta', owned_by: 'meta', capabilities: ['image_generation'], vision: false, free: false, cost: '$0.01/imagen' },
  { id: 'muse-spark-1.2', provider: 'meta', owned_by: 'meta', capabilities: ['text', 'vision'], vision: true, free: false, cost: '$1.25/$4.25 por 1M' },
  { id: 'muse-spark-1.1', provider: 'meta', owned_by: 'meta', capabilities: ['text', 'vision'], vision: true, free: false, cost: '$1.25/$4.25 por 1M' },
  // zen gateway — proxied, incluye gratuitos
  { id: 'opencode-go', provider: 'zen', owned_by: 'opencode', capabilities: ['text', 'vision'], vision: true, free: true, cost: 'gratis' },
  { id: 'opencode-zen', provider: 'zen', owned_by: 'opencode', capabilities: ['text', 'vision'], vision: true, free: true, cost: 'gratis' },
  { id: 'muse-spark-1.2-contributor', provider: 'meta', owned_by: 'meta', capabilities: ['text', 'vision'], vision: true, free: false, cost: '$0.10/$0.20 por 1M' },
]

function inferCapabilities(modelId) {
  const id = String(modelId).toLowerCase()
  if (id.includes('image')) return ['image_generation']
  if (id.includes('spark') || id.includes('go') || id.includes('zen') || id.includes('glimmer')) return ['text', 'vision']
  return ['text']
}

function inferVision(modelId, data) {
  // docs: spark 1.1/1.2 tienen vision, image no
  if (data && typeof data.vision === 'boolean') return data.vision
  if (data && Array.isArray(data.capabilities)) return data.capabilities.includes('vision')
  const caps = inferCapabilities(modelId)
  return caps.includes('vision')
}

function inferFree(modelId, provider) {
  const id = String(modelId).toLowerCase()
  // zen gratuitos contienen -free o go/zen sin costo
  if (provider === 'zen' && (id.includes('free') || id.includes('go') || id.includes('zen'))) return true
  return false
}

async function fetchModels(url, apiKey) {
  const headers = { 'Content-Type': 'application/json' }
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`
  const res = await fetch(url, { headers })
  if (!res.ok) throw new Error(`${url} ${res.status}`)
  const json = await res.json()
  // openai-compat: {object:"list", data:[{id, owned_by, created}]}
  const list = Array.isArray(json.data) ? json.data : Array.isArray(json) ? json : []
  return list
}

export async function listModels({ metaKey, zenKey } = {}) {
  const out = []
  const seen = new Set()

  // cache 24h
  try {
    const cachedRaw = localStorage.getItem('doski:modelCatalogCache')
    if (cachedRaw) {
      const cached = JSON.parse(cachedRaw)
      if (cached && Array.isArray(cached.data) && Date.now() - (cached.at || 0) < 24 * 60 * 60 * 1000) {
        return cached.data
      }
    }
  } catch {}

  // meta
  try {
    const metaList = await fetchModels(META_URL, metaKey)
    for (const m of metaList) {
      const id = m.id || m.name
      if (!id || seen.has(`meta:${id}`)) continue
      seen.add(`meta:${id}`)
      out.push({
        id,
        provider: 'meta',
        owned_by: m.owned_by || 'meta',
        created: m.created,
        capabilities: m.capabilities || inferCapabilities(id),
        vision: inferVision(id, m),
        free: inferFree(id, 'meta'),
        cost: m.cost || (id.includes('image') ? '$0.01/imagen' : ''),
        raw: m,
      })
    }
  } catch (e) {
    console.warn('modelCatalog meta fetch failed', e.message)
  }

  // zen
  try {
    const zenList = await fetchModels(ZEN_URL, zenKey)
    for (const m of zenList) {
      const id = m.id || m.name
      if (!id || seen.has(`zen:${id}`)) continue
      seen.add(`zen:${id}`)
      out.push({
        id,
        provider: 'zen',
        owned_by: m.owned_by || 'opencode',
        created: m.created,
        capabilities: m.capabilities || inferCapabilities(id),
        vision: inferVision(id, m),
        free: m.free ?? inferFree(id, 'zen'),
        cost: m.cost || (inferFree(id, 'zen') ? 'gratis' : ''),
        raw: m,
      })
    }
  } catch (e) {
    console.warn('modelCatalog zen fetch failed', e.message)
  }

  // fallback si nada
  if (!out.length) {
    for (const m of FALLBACK) {
      const k = `${m.provider}:${m.id}`
      if (!seen.has(k)) { seen.add(k); out.push(m) }
    }
  } else {
    // siempre asegurar fallback image + spark estén presentes
    for (const m of FALLBACK) {
      const k = `${m.provider}:${m.id}`
      if (!seen.has(k)) out.push(m)
    }
  }

  // ordenar: image_generation primero, luego vision, luego free primero
  out.sort((a, b) => {
    const aImg = a.capabilities.includes('image_generation') ? 0 : 1
    const bImg = b.capabilities.includes('image_generation') ? 0 : 1
    if (aImg !== bImg) return aImg - bImg
    if (a.free !== b.free) return a.free ? -1 : 1
    return String(a.id).localeCompare(String(b.id))
  })

  try { localStorage.setItem('doski:modelCatalogCache', JSON.stringify({ at: Date.now(), data: out })) } catch {}
  return out
}

export function getFallbackModels() { return FALLBACK }
