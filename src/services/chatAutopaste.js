// chatAutopaste.js — envía prompt + imágenes al webview del chat (chatgpt/gemini/grok/copilot/huggingchat/poe/etc) y extrae imagen generada
// usa webview.executeJavaScript directamente desde el renderer (PromptExporter)
import useChatStore from '../store/chatStore'

function getWebview() {
  return document.querySelector('#doski-chat-webview') || document.querySelector('webview')
}

function getActiveChat() {
  try {
    const raw = localStorage.getItem('doski:chat')
    if (raw) {
      const j = JSON.parse(raw)
      const models = Array.isArray(j.models) ? j.models : []
      const favId = j.favoriteModelId || null
      const fav = models.find(m => m.id === favId) || models[0] || null
      if (fav) return { id: fav.id, url: fav.url, name: fav.name }
      return { id: favId, url: null, name: null }
    }
  } catch {}
  return { id: null, url: null, name: null }
}

function getModelId() { return getActiveChat().id }

function isGeminiModel(modelId) {
  const id = String(modelId || '').toLowerCase()
  return id.includes('gemini')
}
function isMuseModel(modelId, url) {
  const s = String(modelId || '').toLowerCase() + ' ' + String(url || '').toLowerCase()
  return s.includes('muse')
}
function isHfModelCard(url) {
  const u = String(url || '').trim()
  if (!u) return false
  if (u.includes('/chat') || u.includes('/spaces')) return false
  return /^https:\/\/huggingface\.co\/[^\/]+\/[^\/]+\/?(\?.*)?$/.test(u)
}

// --- envío ---

export async function sendToChat({ text, imageDataUrls = [], imageItems = null, newChat = false }) {
  const webview = getWebview()
  if (!webview) throw new Error('chat no disponible: abrí el chat primero')
  try {
    const st = useChatStore.getState()
    if (!st.open) st.setOpen(true)
  } catch {}

  await ensureWebviewReady(webview)

  const active = getActiveChat()
  const modelId = active.id
  const modelUrl = active.url
  const isGemini = isGeminiModel(modelId)
  const isMuse = isMuseModel(modelId, modelUrl)

  // bloqueo temprano: fichas hf no son chats
  if (isHfModelCard(modelUrl)) {
    throw new Error('este modelo apunta a una ficha de huggingface (no es un chat). elegí uno de la lista nueva tipo chatgpt/gemini/grok/copilot/huggingchat o agregá un chat con playground (ej. https://huggingface.co/chat o un space).')
  }

  await delay(400)
  webview.focus?.()

  if (newChat) {
    try {
      let target = null
      if (modelUrl && /^https?:\/\//.test(String(modelUrl))) target = String(modelUrl)
      else if (isGemini) target = 'https://gemini.google.com/app'
      else if (isMuse) target = 'https://www.meta.ai/'
      else target = 'https://chatgpt.com/'
      console.log('[doski newChat] host navigation to', target, 'active', active)
      const withTs = target + (target.includes('?') ? '&' : '?') + 'doski=' + Date.now()
      try { webview.src = withTs } catch {}
      try { webview.loadURL?.(withTs) } catch {}
      const ok = await waitForComposer(webview, 12000)
      console.log('[doski newChat] composer ready?', ok)
      await delay(600)
    } catch (e) { console.warn('newChat failed', e) }
  }

  const composerReady = await waitForComposer(webview, 8000)
  if (!composerReady) console.warn('[doski] composer no apareció antes de inyectar, igual intento')

  let items = null
  if (Array.isArray(imageItems) && imageItems.length) items = imageItems.map(it => ({ dataUrl: it.dataUrl, fileName: it.fileName || 'imagen.png' }))
  else if (Array.isArray(imageDataUrls) && imageDataUrls.length) items = imageDataUrls.filter(Boolean).map((u, i) => ({ dataUrl: u, fileName: `ref-${i + 1}.png` }))
  else items = []

  const payload = { text: String(text || ''), imageItems: items, isGemini, isMuse, modelUrl, _legacyDataUrls: imageDataUrls.filter(Boolean) }
  let result
  try {
    result = await execWithTimeout(webview, `(${injectedSend.toString()})(${JSON.stringify(payload).replace(/`/g, '\\`')})`, 35000)
  } catch (e) {
    throw new Error(e.message === 'timeout executeJavaScript' ? 'el chat tardó demasiado en responder (timeout 30s)' : e.message)
  }
  if (result && result.error) throw new Error(result.error)
  return result
}

async function injectedNewChat(opts) {
  const isGemini = opts?.isGemini
  const log = (...a) => console.log('[doski newChat]', ...a)
  function findNewChatBtn() {
    if (isGemini) {
      const gemSelectors = ['button[aria-label*="New chat"]', 'button[aria-label*="Nuevo chat"]', 'a[href*="/app"]']
      for (const sel of gemSelectors) {
        const el = document.querySelector(sel)
        if (el && /new|nuevo/i.test(el.textContent || el.ariaLabel || '')) return el
      }
      for (const b of document.querySelectorAll('button')) {
        const t = (b.textContent || '').trim().toLowerCase()
        if (t === 'nuevo chat' || t === 'new chat' || t.includes('nueva conversación')) return b
      }
      return null
    }
    const selectors = ['a[data-testid="create-new-chat-button"]', 'button[data-testid="create-new-chat-button"]', '[data-testid="new-chat-button"]', 'a[href="/"]', 'button[aria-label*="New chat"]', 'button[aria-label*="Nuevo chat"]', 'button[aria-label*="Nueva conversación"]']
    for (const sel of selectors) {
      const el = document.querySelector(sel)
      if (el) {
        if (sel === 'a[href="/"]') {
          const nav = el.closest('nav')
          if (nav) { log('newChat selector', sel, 'en nav'); return el }
          continue
        }
        log('newChat selector', sel, el.textContent?.slice(0, 30))
        return el
      }
    }
    const nav = document.querySelector('nav')
    if (nav) {
      for (const a of nav.querySelectorAll('a')) {
        const t = (a.textContent || '').trim().toLowerCase()
        if (t === 'nuevo chat' || t === 'new chat' || t.startsWith('nueva conversación')) return a
      }
      for (const b of nav.querySelectorAll('button')) {
        const t = (b.textContent || '').trim().toLowerCase()
        if (t === 'nuevo chat' || t === 'new chat') return b
      }
    }
    for (const b of document.querySelectorAll('button, a')) {
      const aria = (b.getAttribute('aria-label') || '').toLowerCase()
      if (aria.includes('new chat') || aria.includes('nuevo chat')) return b
    }
    return null
  }
  try {
    const btn = findNewChatBtn()
    if (btn) { log('new chat btn encontrado', btn.tagName, btn.textContent?.slice(0, 40), btn.href || ''); btn.click(); await new Promise(r => setTimeout(r, 900)); return { ok: true, via: 'button' } }
    const target = isGemini ? 'https://gemini.google.com/app' : 'https://chatgpt.com/'
    log('no se encontró botón, navegando a', target); location.href = target; await new Promise(r => setTimeout(r, 1200)); return { ok: true, via: 'navigate' }
  } catch (e) { return { error: String(e?.message || e) } }
}

async function ensureWebviewReady(webview) {
  const deadline = Date.now() + 8000
  while (Date.now() < deadline) {
    try { const url = webview.getURL?.(); if (url && url !== 'about:blank') break } catch {}
    await delay(250)
  }
  await delay(300)
}

async function waitForComposer(webview, timeout = 10000) {
  const genericSelectors = [
    '#prompt-textarea',
    '[data-testid="prompt-textarea"]',
    'div[contenteditable="true"][data-lexical-editor]',
    'div[contenteditable="true"][role="textbox"]',
    'rich-textarea[aria-label]',
    'div[contenteditable="true"]',
    'textarea',
    'input[type="text"]',
  ].join(', ')
  const js = `(() => !!document.querySelector('${genericSelectors.replace(/'/g, "\\'")}'))()`
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    try { const ok = await webview.executeJavaScript(js); if (ok) return true } catch {}
    await delay(400)
  }
  return false
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)) }
async function execWithTimeout(webview, js, ms = 25000) {
  return Promise.race([webview.executeJavaScript(js), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout executeJavaScript')), ms))])
}

// Esta función se serializa y corre DENTRO del webview (guest).
async function injectedSend(payload) {
  const { text, imageDataUrls, isGemini, imageItems, _legacyDataUrls, modelUrl } = payload || {}
  const rawItems = Array.isArray(imageItems) && imageItems.length ? imageItems : (Array.isArray(imageDataUrls) ? imageDataUrls.map((u, i) => ({ dataUrl: u, fileName: `ref-${i + 1}.png` })) : [])
  const log = (...a) => console.log('[doski autopaste]', ...a)
  const host = location.host || ''

  function isVisible(el) {
    if (!el) return false
    const r = el.getBoundingClientRect()
    if (r.width < 2 || r.height < 2) return false
    const style = window.getComputedStyle(el)
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false
    // offsetParent null puede ser por fixed, así que solo filtrar si no está en viewport y es tiny
    return true
  }

  // --- composer detection ---

  function findChatGPTComposer() {
    const selectors = ['#prompt-textarea', '[data-testid="prompt-textarea"]', 'div[contenteditable="true"][data-lexical-editor]', 'div[contenteditable="true"]#prompt-textarea', 'div.ProseMirror[contenteditable="true"]']
    for (const sel of selectors) { const el = document.querySelector(sel); if (el && isVisible(el)) return el }
    return null
  }
  function findGeminiComposer() {
    const selectors = ['rich-textarea[aria-label]', 'div[contenteditable="true"][role="textbox"]', 'textarea[aria-label]']
    for (const sel of selectors) { const el = document.querySelector(sel); if (el && isVisible(el)) return el }
    return null
  }
  function findGenericComposer() {
    const selectors = [
      'textarea[placeholder]',
      'textarea',
      'div[contenteditable="true"]',
      'input[type="text"]',
      '[role="textbox"]',
      'rich-textarea',
    ]
    const candidates = []
    for (const sel of selectors) {
      for (const el of document.querySelectorAll(sel)) {
        if (!isVisible(el)) continue
        const rect = el.getBoundingClientRect()
        // composer suele estar abajo: priorizar los más cercanos al fondo
        const distFromBottom = window.innerHeight - rect.bottom
        // filtrar los de arriba tipo search bars muy pequeños
        if (rect.width < 120 || rect.height < 18) continue
        // heuristic: si está muy arriba y no es contenteditable, bajar score
        let score = 0
        score += Math.max(0, 1000 - Math.max(0, distFromBottom)) // más abajo = más score
        if (el.tagName === 'TEXTAREA') score += 20
        if (el.getAttribute('contenteditable') === 'true') score += 25
        if (/prompt|message|ask|escribe|enviar|pregunta/i.test(el.placeholder || el.getAttribute('aria-label') || '')) score += 30
        if (/chat|composer|prompt/i.test(el.id || el.className || '')) score += 15
        candidates.push({ el, score, bottom: rect.bottom })
      }
    }
    if (!candidates.length) return null
    candidates.sort((a, b) => b.score - a.score || b.bottom - a.bottom)
    log('generic candidates', candidates.slice(0, 5).map(c => ({ tag: c.el.tagName, id: c.el.id, cls: String(c.el.className).slice(0, 40), score: c.score, ph: (c.el.placeholder || c.el.getAttribute('aria-label') || '').slice(0, 30) })))
    return candidates[0].el
  }

  function findComposer() {
    if (isGemini) { const g = findGeminiComposer(); if (g) return g }
    const c = findChatGPTComposer()
    if (c) return c
    const gen = findGenericComposer()
    if (gen) return gen
    return document.querySelector('div[contenteditable="true"]') || document.querySelector('textarea') || document.querySelector('input[type="text"]')
  }

  function findSendButtonNear(composer) {
    // intentos específicos primero
    if (isGemini) {
      const g = document.querySelector('button[aria-label*="Send"]') || document.querySelector('button[data-test-id="send-button"]')
      if (g && isVisible(g) && !g.disabled) return g
    }
    const chatgpt = document.querySelector('[data-testid="send-button"]') || document.querySelector('button[data-testid="fruitjuice-send-button"]') || document.querySelector('button#composer-submit-button') || document.querySelector('button[aria-label="Send prompt"]') || document.querySelector('button[aria-label*="Enviar"]')
    if (chatgpt && isVisible(chatgpt) && !chatgpt.disabled) return chatgpt
    const formBtn = document.querySelector('form button[type="submit"]')
    if (formBtn && isVisible(formBtn) && !formBtn.disabled) return formBtn

    // genérico: buscar todos los botones visibles cerca del composer y scoremos
    const compRect = composer ? composer.getBoundingClientRect() : null
    const all = [...document.querySelectorAll('button, [role="button"]')].filter(b => isVisible(b) && !b.disabled)
    const scored = all.map(b => {
      let score = 0
      const aria = (b.getAttribute('aria-label') || '').toLowerCase()
      const title = (b.getAttribute('title') || '').toLowerCase()
      const txt = (b.textContent || '').trim().toLowerCase()
      const hasSvg = !!b.querySelector('svg')
      if (/send|enviar|submit|generate|crear|go\b/.test(aria) || /send|enviar|submit|generate/.test(title) || /send|enviar/.test(txt)) score += 50
      if (hasSvg) score += 10
      if (b.type === 'submit') score += 20
      // proximidad al composer (horizontal/vertical)
      if (compRect) {
        const r = b.getBoundingClientRect()
        const dx = Math.abs((r.left + r.right) / 2 - (compRect.left + compRect.right) / 2)
        const dy = Math.abs((r.top + r.bottom) / 2 - (compRect.top + compRect.bottom) / 2)
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < 400) score += Math.max(0, 30 - dist / 20)
        // si está a la derecha del composer (típico botón enviar)
        if (r.left > compRect.right - 80 && r.top > compRect.top - 40 && r.top < compRect.bottom + 40) score += 15
      } else {
        // sin composer, priorizar botones abajo a la derecha
        const r = b.getBoundingClientRect()
        if (r.bottom > window.innerHeight - 140) score += 10
        if (r.right > window.innerWidth - 140) score += 10
      }
      // penalizar botones de header/nav lejanos
      if (b.closest('nav, header') && compRect && b.getBoundingClientRect().top < compRect.top - 200) score -= 20
      return { b, score }
    }).filter(x => x.score > 0)
    scored.sort((a, b) => b.score - a.score)
    if (scored.length) {
      log('send candidates', scored.slice(0, 4).map(x => ({ score: x.score, txt: (x.b.textContent || '').trim().slice(0, 20), aria: x.b.getAttribute('aria-label') || '', cls: String(x.b.className).slice(0, 40) })))
      return scored[0].b
    }
    return null
  }

  async function insertText(composer, txt) {
    if (!composer || !txt) return
    composer.focus()
    await new Promise(r => setTimeout(r, 80))
    try { document.execCommand('selectAll', false, null) } catch {}
    let inserted = false
    try { inserted = document.execCommand('insertText', false, txt) } catch {}
    if (!inserted) {
      if (composer.tagName === 'TEXTAREA' || composer.tagName === 'INPUT') {
        // para react/controlled: setear via native setter
        const proto = composer.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
        const desc = Object.getOwnPropertyDescriptor(proto, 'value')
        if (desc && desc.set) desc.set.call(composer, txt)
        else composer.value = txt
        composer.dispatchEvent(new Event('input', { bubbles: true }))
        composer.dispatchEvent(new Event('change', { bubbles: true }))
        // algunos chats (poe, huggingchat) escuchan key events
        composer.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }))
      } else {
        const p = composer.querySelector('p')
        if (p) p.textContent = txt
        else composer.textContent = txt
        try {
          const sel = window.getSelection()
          const range = document.createRange()
          range.selectNodeContents(composer)
          range.collapse(false)
          sel.removeAllRanges()
          sel.addRange(range)
        } catch {}
        composer.dispatchEvent(new InputEvent('input', { bubbles: true, data: txt }))
        composer.dispatchEvent(new Event('change', { bubbles: true }))
      }
    }
    composer.dispatchEvent(new InputEvent('input', { bubbles: true }))
    // forzar que frameworks detecten cambio (react)
    try {
      const e = new Event('input', { bubbles: true })
      Object.defineProperty(e, 'target', { writable: false, value: composer })
      composer.dispatchEvent(e)
    } catch {}
    await new Promise(r => setTimeout(r, 120))
  }

  async function findAttachmentInputs(composer) {
    const form = composer ? composer.closest('form') : null
    const all = [...document.querySelectorAll('input[type="file"]')]
    const near = form ? [...form.querySelectorAll('input[type="file"]')] : []
    const composerParent = composer ? composer.parentElement : null
    const nearComposer = composerParent ? [...composerParent.querySelectorAll('input[type="file"]')] : []
    const candidates = [...new Set([...near, ...nearComposer, ...all])]
    if (!candidates.length) {
      const extra = [...document.querySelectorAll('input[accept*="image"], input[accept*="*"]')]
      candidates.push(...extra)
    }
    const hasImageAccept = candidates.some(inp => /image/i.test(inp.accept || ''))
    if (hasImageAccept && candidates.length > 1) {
      const filtered = candidates.filter(inp => /image|\*/i.test(inp.accept || '') || !inp.accept)
      return filtered.length ? filtered : candidates
    }
    return candidates
  }

  async function tryOpenAttachmentPicker(composer) {
    const compRect = composer ? composer.getBoundingClientRect() : null
    const btnSelectors = [
      '[data-testid="composer-plus-btn"]',
      'button[aria-label*="Attach"]',
      'button[aria-label*="Adjuntar"]',
      'button[aria-label*="Adjunto"]',
      'button[aria-label*="Añadir"]',
      'button[aria-label*="Upload"]',
      'button[aria-label*="Subir"]',
      'button[aria-label*="File"]',
      'button[aria-label*="Image"]',
      'button[aria-label*="Imagen"]',
      'button[aria-label*="Paperclip"]',
      'button[title*="Attach"]',
      'button[title*="Adjuntar"]',
      '[aria-label*="Attach"]',
      '[aria-label*="Adjuntar"]',
      'button[aria-label*="Add files"]',
    ]
    for (const sel of btnSelectors) {
      try {
        const els = [...document.querySelectorAll(sel)]
        for (const btn of els) {
          if (!isVisible(btn)) continue
          if (compRect) {
            const r = btn.getBoundingClientRect()
            const dist = Math.abs(r.top - compRect.top) + Math.abs(r.left - compRect.left)
            // si está muy lejos del composer y es un selector genérico, saltar
            const isGenericClip = sel === 'button:has(svg)' || sel.includes('Paperclip')
            if (isGenericClip && dist > 500) continue
            // evitar clicks en header
            if (r.top < 60 && sel.includes('Attach')) continue
          }
          btn.click()
          await new Promise(r => setTimeout(r, 350))
          log('clicked attach picker', sel, (btn.textContent || btn.getAttribute('aria-label') || '').slice(0, 30))
          const after = document.querySelectorAll('input[type="file"]').length
          if (after > 0) break
        }
        if (document.querySelectorAll('input[type="file"]').length) break
      } catch {}
    }
    // también probar botones con ícono clip/paperclip cerca del composer (sin selector aria)
    if (!document.querySelectorAll('input[type="file"]').length) {
      try {
        const nearBtns = compRect ? [...document.querySelectorAll('button')].filter(b => {
          if (!isVisible(b)) return false
          const r = b.getBoundingClientRect()
          return Math.abs(r.top - compRect.top) < 120 && Math.abs(r.left - compRect.left) < 400
        }) : []
        for (const b of nearBtns) {
          const hasClip = b.querySelector('svg') && (b.innerHTML.includes('clip') || b.innerHTML.length < 800)
          const aria = (b.getAttribute('aria-label') || b.getAttribute('title') || '').toLowerCase()
          if (hasClip || /clip|attach|upload|adjunt|añadir|image|imagen/.test(aria) || b.textContent.trim() === '+') {
            try { b.click(); await new Promise(r => setTimeout(r, 350)); log('clicked near composer btn', aria || b.textContent.slice(0, 20)); if (document.querySelectorAll('input[type="file"]').length) break } catch {}
          }
        }
      } catch {}
    }
    for (const inp of document.querySelectorAll('input[type="file"]')) {
      try { inp.style.display = 'block'; inp.style.opacity = '1'; inp.style.position = 'static'; inp.style.width = '1px'; inp.style.height = '1px' } catch {}
    }
  }

  function dataUrlToFile(dataUrl, fileName) {
    try {
      const comma = dataUrl.indexOf(',')
      const header = dataUrl.slice(0, comma)
      const base64 = dataUrl.slice(comma + 1)
      const mimeMatch = header.match(/:(.*?);/)
      const mime = mimeMatch ? mimeMatch[1] : 'image/png'
      const binary = atob(base64)
      const len = binary.length
      const bytes = new Uint8Array(len)
      for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i)
      const blob = new Blob([bytes], { type: mime })
      let rawName = fileName && String(fileName).trim() ? String(fileName).trim() : `ref-${Date.now()}.png`
      const dot = rawName.lastIndexOf('.')
      const base = dot > 0 ? rawName.slice(0, dot) : rawName
      const ext0 = dot > 0 ? rawName.slice(dot + 1) : (mime.split('/')[1] || 'png').split(';')[0]
      const uniq = Date.now().toString(36) + Math.random().toString(36).slice(2, 5)
      const name = `${base}-${uniq}.${ext0}`
      return new File([blob], name, { type: mime })
    } catch (e) { log('dataUrlToFile error', String(fileName).slice(0, 40), String(e).slice(0, 120)); return null }
  }

  async function reencodeForDedup(file, isCover = false) {
    try {
      if (!file.type.startsWith('image/')) return file
      const dataUrl = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(file) })
      const img = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = dataUrl })
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0)
      try {
        if (isCover) {
          const tmp = document.createElement('canvas'); tmp.width = canvas.width; tmp.height = canvas.height; const tctx = tmp.getContext('2d'); tctx.drawImage(canvas, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height)
          const scale = 0.992 + Math.random() * 0.006
          const dx = (canvas.width - canvas.width * scale) / 2
          const dy = (canvas.height - canvas.height * scale) / 2
          ctx.drawImage(tmp, dx, dy, canvas.width * scale, canvas.height * scale)
        }
        ctx.fillStyle = `rgba(255,255,255,0.012)`; ctx.fillRect(0, 0, canvas.width, canvas.height)
        const pts = [{ x: 4, y: 4 }, { x: canvas.width - 10, y: 4 }, { x: 4, y: canvas.height - 10 }, { x: canvas.width - 10, y: canvas.height - 10 }, { x: canvas.width / 2 - 3, y: canvas.height / 2 - 3 }]
        for (const p of pts) for (let dx = 0; dx < 6; dx++) for (let dy = 0; dy < 6; dy++) { const v = Math.floor(Math.random() * 32); ctx.fillStyle = `rgba(${v},${v},${v},0.07)`; ctx.fillRect(p.x + dx, p.y + dy, 1, 1) }
        ctx.font = '9px monospace'; ctx.fillStyle = 'rgba(0,0,0,0.045)'; ctx.fillText(Date.now().toString(36).slice(-7), canvas.width - 44, canvas.height - 5)
      } catch {}
      const isPng = file.type === 'image/png'
      const outType = isPng ? 'image/png' : 'image/jpeg'
      const quality = isPng ? undefined : 0.90 + Math.random() * 0.04
      const blob = await new Promise(res => canvas.toBlob(res, outType, quality))
      if (!blob || blob.size < 1000) return file
      const ext = outType.split('/')[1]
      const newName = file.name.replace(/\.[^.]+$/, `.${ext}`)
      return new File([blob], newName, { type: outType, lastModified: Date.now() })
    } catch (e) { log('reencode dedup falló', file.name, String(e).slice(0, 100)); return file }
  }

  async function pasteImages(composer, itemsOrUrls) {
    const items = Array.isArray(itemsOrUrls) && itemsOrUrls.length && typeof itemsOrUrls[0] === 'object' && itemsOrUrls[0].dataUrl ? itemsOrUrls : (itemsOrUrls || []).map((u, i) => ({ dataUrl: u, fileName: `ref-${i + 1}.png` }))
    if (!composer || !items.length) return { pasted: 0, tried: 0 }
    const files = []
    for (let i = 0; i < items.length; i++) {
      try {
        const { dataUrl, fileName } = items[i]
        if (!dataUrl || !dataUrl.startsWith('data:')) { log('dataUrl no es data: preskip', i, String(dataUrl).slice(0, 40)); continue }
        let file = dataUrlToFile(dataUrl, fileName || `ref-${i + 1}.png`)
        if (!file) { const res = await fetch(dataUrl); const blob = await res.blob(); const ext = (blob.type.split('/')[1] || 'png').split(';')[0]; file = new File([blob], fileName || `ref-${i + 1}.${ext}`, { type: blob.type || 'image/png' }) }
        if (file) { file = await reencodeForDedup(file, i === 0); files.push(file); log('prepared file', i + 1, file.name, file.type, file.size, 'orig', fileName) }
      } catch (e) { log('error preparando blob', i, String(e).slice(0, 200)) }
    }
    log('files preparados', files.length, '/', items.length, files.map(f=>f.name))
    if (!files.length) return { pasted: 0, tried: items.length }

    await tryOpenAttachmentPicker(composer)
    await new Promise(r => setTimeout(r, 200))

    const inputs = await findAttachmentInputs(composer)
    log('file inputs encontrados', inputs.length, inputs.map(i => ({ accept: i.accept, id: i.id, name: i.name, outer: i.outerHTML.slice(0, 120) })))
    if (inputs.length) {
      const dtAll = new DataTransfer()
      files.forEach(f => dtAll.items.add(f))
      const targetInput = inputs[0]
      try {
        try { targetInput.style.display = 'block'; targetInput.style.opacity = '1'; targetInput.style.position = 'absolute'; targetInput.style.left = '-9999px' } catch {}
        try { targetInput.files = dtAll.files } catch { Object.defineProperty(targetInput, 'files', { value: dtAll.files, writable: false, configurable: true }) }
        log('batch dispatch change', targetInput, 'files', dtAll.files.length, [...dtAll.files].map(f=>f.name))
        targetInput.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }))
        targetInput.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }))
        targetInput.dispatchEvent(new InputEvent('change', { bubbles: true }))
        await new Promise(r => setTimeout(r, 1400))
        log('batch asumido como éxito (sin duplicar)')
        return { pasted: files.length, via: 'input-batch' }
      } catch (e) { log('batch input error', String(e).slice(0, 200)) }
    } else { log('no se encontraron inputs, se intentará paste/drop directo') }

    let pasted = 0
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const dt = new DataTransfer()
      dt.items.add(file)
      let used = false
      const seqInputs = await findAttachmentInputs(composer)
      for (const inp of seqInputs) {
        try { try { inp.files = dt.files } catch { Object.defineProperty(inp, 'files', { value: dt.files, writable: false }) }; inp.dispatchEvent(new Event('change', { bubbles: true })); inp.dispatchEvent(new Event('input', { bubbles: true })); used = true; log('imagen', i + 1, 'enviada vía input secuencial', inp); break } catch {}
      }
      if (!used) {
        const targets = [composer, composer.closest('form'), document.body, document.documentElement].filter(Boolean)
        let dispatchedAny = false
        for (const tgt of targets) {
          try {
            tgt.focus?.(); await new Promise(r => setTimeout(r, 40))
            const pasteEvent = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })
            const dispPaste = tgt.dispatchEvent(pasteEvent)
            const dragEnter = new DragEvent('dragenter', { dataTransfer: dt, bubbles: true, cancelable: true })
            const dragOver = new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true })
            const drop = new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true })
            tgt.dispatchEvent(dragEnter); tgt.dispatchEvent(dragOver); const dispDrop = tgt.dispatchEvent(drop)
            log('imagen', i + 1, 'paste/drop en', tgt.tagName || 'document', 'paste', dispPaste, 'drop', dispDrop)
            if (dispPaste || dispDrop) dispatchedAny = true
          } catch (e) { log('paste fallback error en', tgt.tagName, String(e).slice(0, 100)) }
        }
        if (!dispatchedAny) {
          try {
            if (navigator.clipboard && window.ClipboardItem) {
              const item = new ClipboardItem({ [file.type]: file })
              await navigator.clipboard.write([item])
              composer.focus(); document.execCommand('paste')
              log('clipboard.write + execCommand paste intentado', i + 1)
            }
          } catch (e) { log('clipboard.write fallback falló', String(e).slice(0, 120)) }
        }
      }
      pasted++
      await new Promise(r => setTimeout(r, 1100))
    }
    return { pasted, via: pasted ? 'sequential' : 'none' }
  }

  async function triggerSend(composer) {
    await new Promise(r => setTimeout(r, 600))
    const btn = findSendButtonNear(composer)
    if (btn && !btn.disabled) { try { btn.click(); log('send vía click botón', btn.tagName, btn.getAttribute('aria-label') || btn.textContent?.slice(0, 20)); return { via: 'button' } } catch (e) { log('click send falló', String(e).slice(0, 100)) } }
    composer.focus(); await new Promise(r => setTimeout(r, 80))
    const kd = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true, cancelable: true })
    const kp = new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true, cancelable: true })
    const ku = new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true, cancelable: true })
    composer.dispatchEvent(kd); composer.dispatchEvent(kp); composer.dispatchEvent(ku); document.dispatchEvent(kd)
    log('send vía Enter')
    return { via: 'enter' }
  }

  try {
    const composer = findComposer()
    if (!composer) {
      const allEditables = [...document.querySelectorAll('div[contenteditable="true"]')].map(e => e.outerHTML.slice(0, 200))
      const allTextareas = [...document.querySelectorAll('textarea')].map(e => e.outerHTML.slice(0, 200))
      return { error: 'no se encontró el input del chat (probá recargar el chat)', debug: { host, editables: allEditables.slice(0, 3), textareas: allTextareas.slice(0, 2), isGemini, modelUrl } }
    }
    log('composer encontrado', composer.tagName, composer.id, String(composer.className).slice(0, 80), 'host', host)
    try { composer.scrollIntoView({ block: 'center' }) } catch {}
    let pasteRes = null
    if (text) await insertText(composer, text)
    if (rawItems && rawItems.length) {
      pasteRes = await pasteImages(composer, rawItems)
      log('pasteImages done', pasteRes)
      try {
        for (let attempt = 0; attempt < 3; attempt++) {
          await new Promise(r => setTimeout(r, 600 + attempt * 400))
          const dup = [...document.querySelectorAll('*')].find(el => { const t = (el.textContent || '').trim(); return t.length < 300 && /Ya cargaste este archivo/i.test(t) })
          if (!dup) continue
          log('detectado cartel duplicado', dup.textContent?.slice(0, 100), 'intento', attempt)
          const dialog = dup.closest('[role="dialog"], [data-radix-popper-content-wrapper], .modal, div')
          const scope = dialog || document
          const btn = [...scope.querySelectorAll('button, [role="button"], div, span')].find(b => { const t = (b.textContent || '').trim().toLowerCase(); return t === 'acepta' || t === 'aceptar' || t === 'ok' || t === 'aceptar y continuar' }) || [...document.querySelectorAll('button')].find(b => /acepta/i.test(b.textContent || ''))
          if (btn) { log('click aceptar duplicado', btn.tagName, btn.textContent?.slice(0, 30)); try { btn.click() } catch {}; try { btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); btn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })) } catch {}; await new Promise(r=>setTimeout(r, 400)) }
          pasteRes.duplicateWarning = dup.textContent?.slice(0, 140)
          break
        }
      } catch {}
    }
    const sendRes = await triggerSend(composer)
    return { ok: true, via: sendRes.via, pasted: pasteRes?.pasted ?? 0, expected: rawItems?.length ?? 0, pasteVia: pasteRes?.via || null, duplicateWarning: pasteRes?.duplicateWarning || null }
  } catch (e) { return { error: String(e?.message || e) } }
}

// --- extracción ---

export async function extractLastImageFromChat() {
  const webview = getWebview()
  if (!webview) return null
  await ensureWebviewReady(webview)
  try {
    const base64 = await webview.executeJavaScript(`(${injectedExtract.toString()})()`)
    if (!base64) return null
    if (typeof base64 === 'string' && base64.startsWith('data:')) {
      const b64 = base64.split(',')[1]
      return b64
    }
    return null
  } catch (e) { console.warn('extractLastImage error', e); return null }
}

async function injectedExtract() {
  const log = (...a) => console.log('[doski extract]', ...a)
  function isDataSvg(src) { return src.startsWith('data:image/svg') }
  function isAvatarish(src) { return /avatar|logo|favicon|profile/i.test(src) }

  function collectImages() {
    const out = []
    const seen = new Set()
    for (const img of document.querySelectorAll('img')) {
      const src = img.currentSrc || img.src || img.getAttribute('data-src') || ''
      if (!src || seen.has(src)) continue
      seen.add(src)
      const rect = img.getBoundingClientRect()
      const w = Math.round(rect.width)
      const h = Math.round(rect.height)
      const visible = w > 140 && h > 140 && w < window.innerWidth * 0.98
      if (!visible) continue
      if (isAvatarish(src) || isDataSvg(src)) continue
      out.push({ img, src, w, h, top: rect.top + window.scrollY, score: 0 })
    }
    if (!out.length) {
      for (const a of document.querySelectorAll('a[href]')) {
        const href = a.href || ''
        if (!/\.(png|jpg|jpeg|webp)(\?|$)/i.test(href) && !href.includes('oaiusercontent') && !href.includes('grok') && !href.includes('copilot') && !href.includes('huggingface')) continue
        if (seen.has(href)) continue
        seen.add(href)
        out.push({ img: a, src: href, w: 500, h: 500, top: a.getBoundingClientRect().top + window.scrollY, score: 0 })
      }
    }
    for (const c of out) {
      let s = 0
      if (/oaiusercontent|dalle|openai|generated|grokusercontent|copilot|huggingface|poe|perplexity/i.test(c.src)) s += 100
      if (c.w > 300 && c.h > 300) s += 20
      s += Math.min(c.w, 800) / 100
      c.score = s
    }
    out.sort((a, b) => a.top - b.top || a.score - b.score)
    return out
  }

  const candidates = collectImages()
  log('candidates', candidates.length, candidates.map(c => ({ w: c.w, h: c.h, score: c.score, src: c.src.slice(0, 90) })))
  if (!candidates.length) { log('no candidates: dumping all img srcs', [...document.querySelectorAll('img')].slice(0, 8).map(i => (i.currentSrc || i.src || '').slice(0, 120))); return null }

  const ordered = [...candidates].reverse()
  const topSlice = ordered.slice(0, 3).sort((a, b) => b.score - a.score)
  const tryOrder = [...topSlice, ...ordered.slice(3)]

  async function srcToDataUrl(src, imgEl) {
    if (src.startsWith('data:')) return src
    try {
      const res = await fetch(src, { mode: 'cors', credentials: 'include' })
      if (res.ok) {
        const blob = await res.blob()
        if (blob.size > 5000) return await new Promise((res2, rej) => { const fr = new FileReader(); fr.onload = () => res2(fr.result); fr.onerror = rej; fr.readAsDataURL(blob) })
        log('blob chico vía fetch', blob.size)
      } else log('fetch no ok', res.status, src.slice(0, 80))
    } catch (e) { log('fetch con credenciales falló', String(e).slice(0, 120), src.slice(0, 80)) }
    try {
      if (imgEl && imgEl.tagName === 'IMG' && imgEl.complete && imgEl.naturalWidth > 0) {
        const canvas = document.createElement('canvas'); canvas.width = imgEl.naturalWidth; canvas.height = imgEl.naturalHeight; const ctx = canvas.getContext('2d'); ctx.drawImage(imgEl, 0, 0); const dataUrl = canvas.toDataURL('image/png')
        if (dataUrl && dataUrl.length > 1000) { log('canvas fallback ok', dataUrl.length); return dataUrl }
      }
    } catch (e) { log('canvas fallback tainted', String(e).slice(0, 120)) }
    return null
  }

  for (const cand of tryOrder) {
    log('trying', cand.src.slice(0, 110), cand.w, cand.h, cand.score)
    const dataUrl = await srcToDataUrl(cand.src, cand.img)
    if (dataUrl && dataUrl.startsWith('data:') && dataUrl.length > 5000) { log('chosen', cand.src.slice(0, 110), 'len', dataUrl.length); return dataUrl }
  }
  log('ningún candidato pudo convertirse')
  return null
}
