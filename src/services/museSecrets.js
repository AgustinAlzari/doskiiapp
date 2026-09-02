// museSecrets.js — MVP localStorage, escalado futuro a safeStorage + authors/{id}.json
// TODO escalado: migrar a electron safeStorage + preload authorSecrets:{get,set} (ver plan-lab1 §4.1)

const KEY = 'doski:muse'

function readRaw() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch { return null }
}

export function getMuseSecrets() {
  const d = readRaw()
  if (!d) return { provider: 'meta', apiKey: '', keyHint: '' }
  return {
    provider: d.provider || 'meta',
    apiKey: d.apiKey || '',
    keyHint: d.keyHint || (d.apiKey ? `...${String(d.apiKey).slice(-4)}` : ''),
    createdAt: d.createdAt || null,
  }
}

export function setMuseSecrets({ provider, apiKey }) {
  const cleanKey = String(apiKey || '').trim()
  const cleanProvider = provider === 'zen' ? 'zen' : 'meta'
  const hint = cleanKey ? `...${cleanKey.slice(-4)}` : ''
  const data = { provider: cleanProvider, apiKey: cleanKey, keyHint: hint, createdAt: new Date().toISOString() }
  try { localStorage.setItem(KEY, JSON.stringify(data)) } catch {}
  return getMuseSecrets()
}

export function clearMuseSecrets() {
  try { localStorage.removeItem(KEY) } catch {}
}

export function hasMuseKey() {
  return !!getMuseSecrets().apiKey
}
