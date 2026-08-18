import { ONOMATOPEYAS, COMIC_EXTRA_WORDS } from '../data/onomatopeyas'

let spellPromise = null
let allowList = null

const STORAGE_KEY = 'doski:spell-words'

const BASE_ALLOW = new Set([...ONOMATOPEYAS, ...COMIC_EXTRA_WORDS])

function loadAllowList() {
  if (allowList) return allowList
  const saved = []
  try { saved.push(...(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') || [])) } catch {}
  allowList = new Set([...BASE_ALLOW, ...saved].map(w => w.toLowerCase()))
  return allowList
}

function ensureSpell() {
  if (!spellPromise) {
    spellPromise = (async () => {
      const nspellMod = await import('nspell')
      const affMod = await import('../assets/dictionaries/es.aff?raw')
      const dicMod = await import('../assets/dictionaries/es.dic?raw')
      const nspell = nspellMod.default || nspellMod
      return nspell({ aff: affMod.default, dic: dicMod.default })
    })()
  }
  return spellPromise
}

const WORD_RE = /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ'’]+/g

export function isKnownWord(word) {
  return loadAllowList().has(word.toLowerCase())
}

// Devuelve [{ word, index, length, suggestions }] para cada palabra fuera del diccionario.
export async function checkText(text) {
  const spell = await ensureSpell()
  const issues = []
  const str = String(text || '')
  const re = new RegExp(WORD_RE.source, 'g')
  let m
  while ((m = re.exec(str))) {
    const word = m[0]
    if (isKnownWord(word)) continue
    if (spell.correct(word)) continue
    issues.push({ word, index: m.index, length: word.length, suggestions: spell.suggest(word, 5) })
  }
  return issues
}

export function addWord(word) {
  const list = loadAllowList()
  list.add(word.toLowerCase())
  const saved = []
  try { saved.push(...(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') || [])) } catch {}
  if (!saved.includes(word.toLowerCase())) {
    saved.push(word.toLowerCase())
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(saved)) } catch {}
  }
}

export async function hasDictionary() {
  try {
    await ensureSpell()
    return true
  } catch {
    return false
  }
}
