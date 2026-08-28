// chatAutopaste.js — envía prompt + imágenes al webview del chat (chatgpt/gemini) y extrae imagen generada
// usa webview.executeJavaScript directamente desde el renderer (PromptExporter/PreviewExport)
import useChatStore from '../store/chatStore'

function getWebview() {
  // ChatPanel monta un único <webview> fijo; lo buscamos por DOM (id primero)
  return document.querySelector('#doski-chat-webview') || document.querySelector('webview')
}

function getModelId() {
  try {
    const raw = localStorage.getItem('doski:chat')
    if (raw) {
      const j = JSON.parse(raw)
      return j.favoriteModelId || null
    }
  } catch {}
  return null
}

function isGeminiModel(modelId) {
  const id = String(modelId || '').toLowerCase()
  return id.includes('gemini')
}

// --- envío ---

export async function sendToChat({ text, imageDataUrls = [], imageItems = null, newChat = false }) {
  const webview = getWebview()
  if (!webview) throw new Error('chat no disponible: abrí el chat primero')
  // asegurar que el chat esté abierto
  try {
    const st = useChatStore.getState()
    if (!st.open) st.setOpen(true)
  } catch {}

  // esperar a que el webview esté cargado
  await ensureWebviewReady(webview)

  const modelId = getModelId()
  const isGemini = isGeminiModel(modelId)

  // pequeño delay para que el panel se asiente
  await delay(400)
  // re-focus
  webview.focus?.()

  if (newChat) {
    try {
      const target = isGemini ? 'https://gemini.google.com/app' : 'https://chatgpt.com/'
      console.log('[doski newChat] host navigation to', target)
      const withTs = target + (target.includes('?') ? '&' : '?') + 'doski=' + Date.now()
      // navegación host forzada (con timestamp para evitar cache) — no esperar did-finish-load bloqueante,
      // porque chatgpt es SPA y no siempre dispara did-finish-load al navegar interno
      try { webview.src = withTs } catch {}
      try { webview.loadURL?.(withTs) } catch {}
      // esperar a que el composer del nuevo chat esté realmente montado (polling)
      const ok = await waitForComposer(webview, 12000)
      console.log('[doski newChat] composer ready?', ok)
      await delay(600)
    } catch (e) {
      console.warn('newChat failed', e)
    }
  }

  // asegurar composer listo antes de inyectar (evita colgado en "pegando")
  const composerReady = await waitForComposer(webview, 8000)
  if (!composerReady) console.warn('[doski] composer no apareció antes de inyectar, igual intento')

  // normalizar a imageItems con nombre (evita colisión de hash por nombre genérico ref-1)
  let items = null
  if (Array.isArray(imageItems) && imageItems.length) {
    items = imageItems.map(it => ({ dataUrl: it.dataUrl, fileName: it.fileName || 'imagen.png' }))
  } else if (Array.isArray(imageDataUrls) && imageDataUrls.length) {
    items = imageDataUrls.filter(Boolean).map((u, i) => ({ dataUrl: u, fileName: `ref-${i + 1}.png` }))
  } else {
    items = []
  }
  // ejecutar inyección en el guest con timeout (evita quedar colgado en "pegando")
  const payload = { text: String(text || ''), imageItems: items, isGemini, _legacyDataUrls: imageDataUrls.filter(Boolean) }
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
      const gemSelectors = [
        'button[aria-label*="New chat"]',
        'button[aria-label*="Nuevo chat"]',
        'a[href*="/app"]',
      ]
      for (const sel of gemSelectors) {
        const el = document.querySelector(sel)
        if (el && /new|nuevo/i.test(el.textContent || el.ariaLabel || '')) return el
      }
      // gemini: botón "Nueva conversación"
      for (const b of document.querySelectorAll('button')) {
        const t = (b.textContent || '').trim().toLowerCase()
        if (t === 'nuevo chat' || t === 'new chat' || t.includes('nueva conversación')) return b
      }
      return null
    }
    // chatgpt — probamos varios (sin incluir el plus del composer)
    const selectors = [
      'a[data-testid="create-new-chat-button"]',
      'button[data-testid="create-new-chat-button"]',
      '[data-testid="new-chat-button"]',
      'a[href="/"]',
      'button[aria-label*="New chat"]',
      'button[aria-label*="Nuevo chat"]',
      'button[aria-label*="Nueva conversación"]',
    ]
    // buscar por selector preciso
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
    // fallback: buscar por texto en nav
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
    // último fallback: buscar botón con ícono lápiz (svg) en header/sidebar
    for (const b of document.querySelectorAll('button, a')) {
      const aria = (b.getAttribute('aria-label') || '').toLowerCase()
      if (aria.includes('new chat') || aria.includes('nuevo chat')) return b
    }
    return null
  }

  try {
    const btn = findNewChatBtn()
    if (btn) {
      log('new chat btn encontrado', btn.tagName, btn.textContent?.slice(0, 40), btn.href || '')
      btn.click()
      await new Promise(r => setTimeout(r, 900))
      // si es link, ya navegó; si es botón, esperar
      return { ok: true, via: 'button' }
    }
    // fallback: navegar directo a nuevo chat
    const target = isGemini ? 'https://gemini.google.com/app' : 'https://chatgpt.com/'
    log('no se encontró botón, navegando a', target)
    location.href = target
    await new Promise(r => setTimeout(r, 1200))
    return { ok: true, via: 'navigate' }
  } catch (e) {
    return { error: String(e?.message || e) }
  }
}

async function ensureWebviewReady(webview) {
  const deadline = Date.now() + 8000
  while (Date.now() < deadline) {
    try {
      const url = webview.getURL?.()
      if (url && url !== 'about:blank') break
    } catch {}
    await delay(250)
  }
  await delay(300)
}

async function waitForComposer(webview, timeout = 10000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    try {
      const ok = await webview.executeJavaScript(`(() => !!document.querySelector('#prompt-textarea, [data-testid="prompt-textarea"], div[contenteditable="true"][data-lexical-editor], div[contenteditable="true"][role="textbox"]'))()`)
      if (ok) return true
    } catch {}
    await delay(400)
  }
  return false
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)) }

async function execWithTimeout(webview, js, ms = 25000) {
  return Promise.race([
    webview.executeJavaScript(js),
    new Promise((_, rej) => setTimeout(() => rej(new Error('timeout executeJavaScript')), ms)),
  ])
}

// Esta función se serializa y corre DENTRO del webview (guest).
// No puede usar imports del host.
async function injectedSend(payload) {
  const { text, imageDataUrls, isGemini, imageItems, _legacyDataUrls } = payload || {}
  // normalizar a items con fileName (evita colisión por nombre genérico ref-1)
  const rawItems = Array.isArray(imageItems) && imageItems.length
    ? imageItems
    : (Array.isArray(imageDataUrls) ? imageDataUrls.map((u, i) => ({ dataUrl: u, fileName: `ref-${i + 1}.png` })) : [])
  const log = (...a) => console.log('[doski autopaste]', ...a)

  function findChatGPTComposer() {
    // candidatos actuales 2024-2026
    const selectors = [
      '#prompt-textarea',
      '[data-testid="prompt-textarea"]',
      'div[contenteditable="true"][data-lexical-editor]',
      'div[contenteditable="true"]#prompt-textarea',
      'div.ProseMirror[contenteditable="true"]',
      'div[contenteditable="true"]',
    ]
    for (const sel of selectors) {
      const el = document.querySelector(sel)
      if (el) return el
    }
    return null
  }

  function findGeminiComposer() {
    const selectors = [
      'rich-textarea[aria-label]',
      'div[contenteditable="true"][role="textbox"]',
      'div[contenteditable="true"]',
      'textarea[aria-label]',
    ]
    for (const sel of selectors) {
      const el = document.querySelector(sel)
      if (el) return el
    }
    return null
  }

  function findComposer() {
    if (isGemini) {
      const g = findGeminiComposer()
      if (g) return g
    }
    const c = findChatGPTComposer()
    if (c) return c
    // fallback genérico
    return document.querySelector('div[contenteditable="true"]') || document.querySelector('textarea')
  }

  function findSendButton() {
    if (isGemini) {
      return document.querySelector('button[aria-label*="Send"]') ||
        document.querySelector('button[data-test-id="send-button"]') ||
        document.querySelector('button:has(svg)') // fallback
    }
    // chatgpt
    return document.querySelector('[data-testid="send-button"]') ||
      document.querySelector('button[data-testid="fruitjuice-send-button"]') ||
      document.querySelector('button#composer-submit-button') ||
      document.querySelector('button[aria-label="Send prompt"]') ||
      document.querySelector('button[aria-label*="Enviar"]') ||
      document.querySelector('form button[type="submit"]')
  }

  async function insertText(composer, txt) {
    if (!composer || !txt) return
    composer.focus()
    await new Promise(r => setTimeout(r, 80))
    // limpiar y seleccionar todo
    try { document.execCommand('selectAll', false, null) } catch {}
    // intentar execCommand
    let inserted = false
    try {
      inserted = document.execCommand('insertText', false, txt)
    } catch {}
    if (!inserted) {
      // fallback: setear contenido directamente
      if (composer.tagName === 'TEXTAREA' || composer.tagName === 'INPUT') {
        composer.value = txt
        composer.dispatchEvent(new Event('input', { bubbles: true }))
        composer.dispatchEvent(new Event('change', { bubbles: true }))
      } else {
        // contenteditable: reemplazar texto
        // preservar estructura de <p> si existe
        const p = composer.querySelector('p')
        if (p) p.textContent = txt
        else composer.textContent = txt
        // mover cursor al final
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
    // disparar input para que lexical detecte
    composer.dispatchEvent(new InputEvent('input', { bubbles: true }))
    await new Promise(r => setTimeout(r, 120))
  }

  async function findAttachmentInputs(composer) {
    const form = composer.closest('form') || document.querySelector('form')
    const all = [...document.querySelectorAll('input[type="file"]')]
    // priorizar los que están dentro del form/composer
    const near = form ? [...form.querySelectorAll('input[type="file"]')] : []
    const candidates = [...new Set([...near, ...all])]
    // si no hay, buscar inputs ocultos que se crean dinámicamente (a veces están fuera del form)
    if (!candidates.length) {
      // chatgpt a veces usa input fuera del form con id file-upload
      const extra = [...document.querySelectorAll('input[accept*="image"], input[accept*="*"]')]
      candidates.push(...extra)
    }
    // filtrar por accept que incluya imagen si hay muchos
    const hasImageAccept = candidates.some(inp => /image/i.test(inp.accept || ''))
    if (hasImageAccept && candidates.length > 1) {
      const filtered = candidates.filter(inp => /image|\*/i.test(inp.accept || '') || !inp.accept)
      return filtered.length ? filtered : candidates
    }
    return candidates
  }

  async function tryOpenAttachmentPicker(composer) {
    const btnSelectors = [
      '[data-testid="composer-plus-btn"]',
      'button[aria-label*="Attach"]',
      'button[aria-label*="Adjuntar"]',
      'button[aria-label*="Añadir"]',
      '[aria-label*="Upload"]',
      'button:has(svg)',
    ]
    for (const sel of btnSelectors) {
      try {
        const btn = document.querySelector(sel)
        if (!btn) continue
        // solo click si parece ser el de adjuntar (cerca del composer)
        const rect = btn.getBoundingClientRect()
        const compRect = composer.getBoundingClientRect()
        const near = Math.abs(rect.top - compRect.top) < 300 && rect.left < window.innerWidth * 0.8
        if (!near && sel === 'button:has(svg)') continue
        btn.click()
        await new Promise(r => setTimeout(r, 350))
        log('clicked attach picker', sel, btn.textContent?.slice(0, 20))
        // verificar si apareció input
        const after = document.querySelectorAll('input[type="file"]').length
        if (after > 0) break
      } catch {}
    }
    // fallback: forzar visibilidad de inputs ocultos
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
      // hacer nombre único por envío para evitar dedupe por nombre (chatgpt recuerda nombres)
      const dot = rawName.lastIndexOf('.')
      const base = dot > 0 ? rawName.slice(0, dot) : rawName
      const ext0 = dot > 0 ? rawName.slice(dot + 1) : (mime.split('/')[1] || 'png').split(';')[0]
      const uniq = Date.now().toString(36) + Math.random().toString(36).slice(2, 5)
      const name = `${base}-${uniq}.${ext0}`
      return new File([blob], name, { type: mime })
    } catch (e) {
      log('dataUrlToFile error', String(fileName).slice(0, 40), String(e).slice(0, 120))
      return null
    }
  }

  async function reencodeForDedup(file, isCover = false) {
    // chatgpt dedupea por hash perceptual + sha global; 1px no alcanza — marca más agresiva
    try {
      if (!file.type.startsWith('image/')) return file
      const dataUrl = await new Promise((res, rej) => {
        const fr = new FileReader()
        fr.onload = () => res(fr.result)
        fr.onerror = rej
        fr.readAsDataURL(file)
      })
      const img = await new Promise((res, rej) => {
        const im = new Image()
        im.onload = () => res(im)
        im.onerror = rej
        im.src = dataUrl
      })
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0)
      // para cover (imagen que chatgpt mismo generó) hacer cambio más fuerte: pequeño recorte + capa tenue
      try {
        if (isCover) {
          // recortar 1px de borde y re-escalar levemente para cambiar pHash sin verse
          const tmp = document.createElement('canvas')
          tmp.width = canvas.width
          tmp.height = canvas.height
          const tctx = tmp.getContext('2d')
          tctx.drawImage(canvas, 0, 0)
          ctx.clearRect(0, 0, canvas.width, canvas.height)
          // dibujar con 0.8% zoom y leve desplazamiento
          const scale = 0.992 + Math.random() * 0.006
          const dx = (canvas.width - canvas.width * scale) / 2
          const dy = (canvas.height - canvas.height * scale) / 2
          ctx.drawImage(tmp, dx, dy, canvas.width * scale, canvas.height * scale)
        }
        // overlay tenue global 1.2% para cambiar brillo perceptual
        ctx.fillStyle = `rgba(255,255,255,0.012)`
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        // bloques de ruido en 4 esquinas + centro
        const pts = [{ x: 4, y: 4 }, { x: canvas.width - 10, y: 4 }, { x: 4, y: canvas.height - 10 }, { x: canvas.width - 10, y: canvas.height - 10 }, { x: canvas.width / 2 - 3, y: canvas.height / 2 - 3 }]
        for (const p of pts) {
          for (let dx = 0; dx < 6; dx++) for (let dy = 0; dy < 6; dy++) {
            const v = Math.floor(Math.random() * 32)
            ctx.fillStyle = `rgba(${v},${v},${v},0.07)`
            ctx.fillRect(p.x + dx, p.y + dy, 1, 1)
          }
        }
        // timestamp tenue en borde inferior
        ctx.font = '9px monospace'
        ctx.fillStyle = 'rgba(0,0,0,0.045)'
        ctx.fillText(Date.now().toString(36).slice(-7), canvas.width - 44, canvas.height - 5)
      } catch {}
      const isPng = file.type === 'image/png'
      const outType = isPng ? 'image/png' : 'image/jpeg'
      const quality = isPng ? undefined : 0.90 + Math.random() * 0.04
      const blob = await new Promise(res => canvas.toBlob(res, outType, quality))
      if (!blob || blob.size < 1000) return file
      const ext = outType.split('/')[1]
      const newName = file.name.replace(/\.[^.]+$/, `.${ext}`)
      return new File([blob], newName, { type: outType, lastModified: Date.now() })
    } catch (e) {
      log('reencode dedup falló', file.name, String(e).slice(0, 100))
      return file
    }
  }

  async function pasteImages(composer, itemsOrUrls) {
    const items = Array.isArray(itemsOrUrls) && itemsOrUrls.length && typeof itemsOrUrls[0] === 'object' && itemsOrUrls[0].dataUrl
      ? itemsOrUrls
      : (itemsOrUrls || []).map((u, i) => ({ dataUrl: u, fileName: `ref-${i + 1}.png` }))
    if (!composer || !items.length) return { pasted: 0, tried: 0 }
    const files = []
    for (let i = 0; i < items.length; i++) {
      try {
        const { dataUrl, fileName } = items[i]
        if (!dataUrl || !dataUrl.startsWith('data:')) {
          log('dataUrl no es data: preskip', i, String(dataUrl).slice(0, 40))
          continue
        }
        let file = dataUrlToFile(dataUrl, fileName || `ref-${i + 1}.png`)
        if (!file) {
          const res = await fetch(dataUrl)
          const blob = await res.blob()
          const ext = (blob.type.split('/')[1] || 'png').split(';')[0]
          file = new File([blob], fileName || `ref-${i + 1}.${ext}`, { type: blob.type || 'image/png' })
        }
        if (file) {
          // para la primera imagen (cover en diálogos) usar reencode más agresivo
          file = await reencodeForDedup(file, i === 0)
          files.push(file)
          log('prepared file', i + 1, file.name, file.type, file.size, 'orig', fileName)
        }
      } catch (e) {
        log('error preparando blob', i, String(e).slice(0, 200))
      }
    }
    log('files preparados', files.length, '/', items.length, files.map(f=>f.name))
    if (!files.length) return { pasted: 0, tried: items.length }

    // intentar abrir picker por si el input está lazy
    await tryOpenAttachmentPicker(composer)
    await new Promise(r => setTimeout(r, 200))

    // intento 1: batch vía input[type=file] (todas juntas) — es lo que chatgpt espera para multi-adjunto
    const inputs = await findAttachmentInputs(composer)
    log('file inputs encontrados', inputs.length, inputs.map(i => ({ accept: i.accept, id: i.id, name: i.name, outer: i.outerHTML.slice(0, 120) })))
    if (inputs.length) {
      const dtAll = new DataTransfer()
      files.forEach(f => dtAll.items.add(f))
      // usar el primer input que acepte imágenes (el más cercano al composer)
      const targetInput = inputs[0]
      try {
        try { targetInput.style.display = 'block'; targetInput.style.opacity = '1'; targetInput.style.position = 'absolute'; targetInput.style.left = '-9999px' } catch {}
        try { targetInput.files = dtAll.files } catch {
          Object.defineProperty(targetInput, 'files', { value: dtAll.files, writable: false, configurable: true })
        }
        log('batch dispatch change', targetInput, 'files', dtAll.files.length, [...dtAll.files].map(f=>f.name))
        targetInput.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }))
        targetInput.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }))
        targetInput.dispatchEvent(new InputEvent('change', { bubbles: true }))
        await new Promise(r => setTimeout(r, 1400))
        log('batch asumido como éxito (sin duplicar)')
        return { pasted: files.length, via: 'input-batch' }
      } catch (e) {
        log('batch input error', String(e).slice(0, 200))
        // si el batch falló, caerá al paste/drop
      }
    } else {
      log('no se encontraron inputs, se intentará paste/drop directo')
    }

    // intento 2: secuencial por input (uno por uno)
    let pasted = 0
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const dt = new DataTransfer()
      dt.items.add(file)
      let used = false
      const seqInputs = await findAttachmentInputs(composer)
      for (const inp of seqInputs) {
        try {
          try { inp.files = dt.files } catch { Object.defineProperty(inp, 'files', { value: dt.files, writable: false }) }
          inp.dispatchEvent(new Event('change', { bubbles: true }))
          inp.dispatchEvent(new Event('input', { bubbles: true }))
          used = true
          log('imagen', i + 1, 'enviada vía input secuencial', inp)
          break
        } catch {}
      }
      if (!used) {
        // fallback: paste/drop en múltiples targets (composer, form, body, document)
        const targets = [composer, composer.closest('form'), document.body, document.documentElement].filter(Boolean)
        let dispatchedAny = false
        for (const tgt of targets) {
          try {
            tgt.focus?.()
            await new Promise(r => setTimeout(r, 40))
            // paste
            const pasteEvent = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })
            const dispPaste = tgt.dispatchEvent(pasteEvent)
            // drag sequence
            const dragEnter = new DragEvent('dragenter', { dataTransfer: dt, bubbles: true, cancelable: true })
            const dragOver = new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true })
            const drop = new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true })
            tgt.dispatchEvent(dragEnter)
            tgt.dispatchEvent(dragOver)
            const dispDrop = tgt.dispatchEvent(drop)
            log('imagen', i + 1, 'paste/drop en', tgt.tagName || 'document', 'paste', dispPaste, 'drop', dispDrop)
            if (dispPaste || dispDrop) dispatchedAny = true
          } catch (e) { log('paste fallback error en', tgt.tagName, String(e).slice(0, 100)) }
        }
        // último intento: navigator.clipboard.write dentro del guest (requiere permiso, puede fallar)
        if (!dispatchedAny) {
          try {
            if (navigator.clipboard && window.ClipboardItem) {
              const item = new ClipboardItem({ [file.type]: file })
              await navigator.clipboard.write([item])
              composer.focus()
              document.execCommand('paste')
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
    // esperar un poco a que se habilite el botón
    await new Promise(r => setTimeout(r, 600))
    const btn = findSendButton()
    if (btn && !btn.disabled) {
      btn.click()
      log('send vía click botón', btn)
      return { via: 'button' }
    }
    // fallback: Enter en el composer
    composer.focus()
    await new Promise(r => setTimeout(r, 80))
    const kd = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true, cancelable: true })
    const kp = new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true, cancelable: true })
    const ku = new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true, cancelable: true })
    composer.dispatchEvent(kd)
    composer.dispatchEvent(kp)
    composer.dispatchEvent(ku)
    // también disparar en document por si escucha global
    document.dispatchEvent(kd)
    log('send vía Enter')
    return { via: 'enter' }
  }

  try {
    const composer = findComposer()
    if (!composer) {
      // debug: listar candidatos para diagnóstico
      const allEditables = [...document.querySelectorAll('div[contenteditable="true"]')].map(e => e.outerHTML.slice(0, 200))
      const allTextareas = [...document.querySelectorAll('textarea')].map(e => e.outerHTML.slice(0, 200))
      return { error: 'no se encontró el input del chat (probá recargar el chat)', debug: { editables: allEditables.slice(0, 3), textareas: allTextareas.slice(0, 2), isGemini } }
    }
    log('composer encontrado', composer.tagName, composer.id, composer.className.slice(0, 80))
    // hacer scroll al composer por si está fuera de vista
    try { composer.scrollIntoView({ block: 'center' }) } catch {}

    let pasteRes = null
    if (text) await insertText(composer, text)
    if (rawItems && rawItems.length) {
      pasteRes = await pasteImages(composer, rawItems)
      log('pasteImages done', pasteRes)
      // detectar alerta de duplicado de chatgpt y auto-aceptar (puede tardar 1-2s en aparecer)
      try {
        for (let attempt = 0; attempt < 3; attempt++) {
          await new Promise(r => setTimeout(r, 600 + attempt * 400))
          const dup = [...document.querySelectorAll('*')].find(el => {
            const t = (el.textContent || '').trim()
            return t.length < 300 && /Ya cargaste este archivo/i.test(t)
          })
          if (!dup) continue
          log('detectado cartel duplicado', dup.textContent?.slice(0, 100), 'intento', attempt)
          // buscar botón Aceptar dentro del mismo diálogo o global
          const dialog = dup.closest('[role="dialog"], [data-radix-popper-content-wrapper], .modal, div')
          const scope = dialog || document
          const btn = [...scope.querySelectorAll('button, [role="button"], div, span')].find(b => {
            const t = (b.textContent || '').trim().toLowerCase()
            return t === 'acepta' || t === 'aceptar' || t === 'ok' || t === 'aceptar y continuar'
          }) || [...document.querySelectorAll('button')].find(b => /acepta/i.test(b.textContent || ''))
          if (btn) {
            log('click aceptar duplicado', btn.tagName, btn.textContent?.slice(0, 30))
            try { btn.click() } catch {}
            // también disparar mousedown/mouseup por si es custom
            try { btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); btn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })) } catch {}
            await new Promise(r=>setTimeout(r, 400))
          }
          pasteRes.duplicateWarning = dup.textContent?.slice(0, 140)
          break
        }
      } catch {}
    }
    const sendRes = await triggerSend(composer)
    return { ok: true, via: sendRes.via, pasted: pasteRes?.pasted ?? 0, expected: rawItems?.length ?? 0, pasteVia: pasteRes?.via || null, duplicateWarning: pasteRes?.duplicateWarning || null }
  } catch (e) {
    return { error: String(e?.message || e) }
  }
}

// --- extracción ---

export async function extractLastImageFromChat() {
  const webview = getWebview()
  if (!webview) return null
  await ensureWebviewReady(webview)
  try {
    const base64 = await webview.executeJavaScript(`(${injectedExtract.toString()})()`)
    if (!base64) return null
    // injectedExtract retorna dataUrl base64 o null
    if (typeof base64 === 'string' && base64.startsWith('data:')) {
      const b64 = base64.split(',')[1]
      return b64
    }
    return null
  } catch (e) {
    console.warn('extractLastImage error', e)
    return null
  }
}

async function injectedExtract() {
  const log = (...a) => console.log('[doski extract]', ...a)
  function isDataSvg(src) { return src.startsWith('data:image/svg') }
  function isAvatarish(src) { return /avatar|logo|favicon|profile/i.test(src) }

  function collectImages() {
    const out = []
    const seen = new Set()
    // 1) todos los <img>
    for (const img of document.querySelectorAll('img')) {
      const src = img.currentSrc || img.src || img.getAttribute('data-src') || ''
      if (!src || seen.has(src)) continue
      seen.add(src)
      const rect = img.getBoundingClientRect()
      const w = Math.round(rect.width)
      const h = Math.round(rect.height)
      // filtrar miniaturas/iconos: exigir área visible mínima
      const visible = w > 140 && h > 140 && w < window.innerWidth * 0.98
      if (!visible) continue
      if (isAvatarish(src) || isDataSvg(src)) continue
      out.push({ img, src, w, h, top: rect.top + window.scrollY, score: 0 })
    }
    // 2) si no hay, buscar <a> con href de imagen (chatgpt a veces pone link descargable)
    if (!out.length) {
      for (const a of document.querySelectorAll('a[href]')) {
        const href = a.href || ''
        if (!/\.(png|jpg|jpeg|webp)(\?|$)/i.test(href) && !href.includes('oaiusercontent')) continue
        if (seen.has(href)) continue
        seen.add(href)
        out.push({ img: a, src: href, w: 500, h: 500, top: a.getBoundingClientRect().top + window.scrollY, score: 0 })
      }
    }
    // score: priorizar oaiusercontent / dalle / files. y tamaño grande
    for (const c of out) {
      let s = 0
      if (/oaiusercontent|dalle|openai|generated/i.test(c.src)) s += 100
      if (c.w > 300 && c.h > 300) s += 20
      s += Math.min(c.w, 800) / 100
      c.score = s
    }
    // ordenar por top (más nuevo al fondo) y luego por score si empatan
    out.sort((a, b) => a.top - b.top || a.score - b.score)
    // si hay empate de top cercano, priorizar score
    return out
  }

  const candidates = collectImages()
  log('candidates', candidates.length, candidates.map(c => ({ w: c.w, h: c.h, score: c.score, src: c.src.slice(0, 90) })))
  if (!candidates.length) {
    log('no candidates: dumping all img srcs', [...document.querySelectorAll('img')].slice(0, 8).map(i => (i.currentSrc || i.src || '').slice(0, 120)))
    return null
  }

  // intentar desde el más nuevo hacia atrás, no solo el último absoluto
  const ordered = [...candidates].reverse() // más nuevo primero
  // priorizar por score dentro de los últimos 3
  const topSlice = ordered.slice(0, 3).sort((a, b) => b.score - a.score)
  const tryOrder = [...topSlice, ...ordered.slice(3)]

  async function srcToDataUrl(src, imgEl) {
    if (src.startsWith('data:')) return src
    // intentar fetch con credenciales (oaiusercontent necesita cookies)
    try {
      const res = await fetch(src, { mode: 'cors', credentials: 'include' })
      if (res.ok) {
        const blob = await res.blob()
        if (blob.size > 5000) {
          return await new Promise((res2, rej) => {
            const fr = new FileReader()
            fr.onload = () => res2(fr.result)
            fr.onerror = rej
            fr.readAsDataURL(blob)
          })
        }
        log('blob chico vía fetch', blob.size)
      } else {
        log('fetch no ok', res.status, src.slice(0, 80))
      }
    } catch (e) {
      log('fetch con credenciales falló', String(e).slice(0, 120), src.slice(0, 80))
    }
    // fallback vía canvas (funciona si la imagen ya está cargada y no está tainted)
    try {
      if (imgEl && imgEl.tagName === 'IMG' && imgEl.complete && imgEl.naturalWidth > 0) {
        const canvas = document.createElement('canvas')
        canvas.width = imgEl.naturalWidth
        canvas.height = imgEl.naturalHeight
        const ctx = canvas.getContext('2d')
        ctx.drawImage(imgEl, 0, 0)
        const dataUrl = canvas.toDataURL('image/png')
        if (dataUrl && dataUrl.length > 1000) {
          log('canvas fallback ok', dataUrl.length)
          return dataUrl
        }
      }
    } catch (e) {
      log('canvas fallback tainted', String(e).slice(0, 120))
    }
    return null
  }

  for (const cand of tryOrder) {
    log('trying', cand.src.slice(0, 110), cand.w, cand.h, cand.score)
    const dataUrl = await srcToDataUrl(cand.src, cand.img)
    if (dataUrl && dataUrl.startsWith('data:') && dataUrl.length > 5000) {
      log('chosen', cand.src.slice(0, 110), 'len', dataUrl.length)
      return dataUrl
    }
  }
  log('ningún candidato pudo convertirse')
  return null
}
