// imageExport.js
// Exportación "limpia" de imágenes: los bytes de salida se re-renderizan desde cero
// (canvas aislado, sin ningún encabezado del archivo fuente) y SOLO después se inyecta
// un diccionario propio de metadatos (autor, copyright, software, fecha, título).
//
// Esto garantiza que ninguna firma C2PA, registro EXIF, XMP ni chunk propietario del
// archivo original sobreviva: la decodificación por píxeles los descarta por construcción.

export const SOFTWARE_NAME = 'doski'

// ---------------------------------------------------------------------------
// Diccionario de metadatos
// ---------------------------------------------------------------------------

// El autor sale de la categoría "autores": el proyecto referencia un autor con authorId.
export function resolveAuthor(project, authors) {
  if (!project?.authorId) return null
  return (authors || []).find(a => a.id === project.authorId) || null
}

// Construye el diccionario estándar. artist/copyright se omiten si no hay autor
// asignado al proyecto (el export igual avanza, pero sin campos de autoría).
export function buildExportMetadata({ author, title }) {
  const name = author?.fullName || ''
  const meta = {
    artist: name,
    title: title || '',
    software: SOFTWARE_NAME,
    dateTime: new Date().toISOString(),
  }
  if (name) {
    meta.copyright = `© ${new Date().getFullYear()} ${name}. Todos los derechos reservados.`
  }
  return meta
}

// ---------------------------------------------------------------------------
// Utilidades binarias
// ---------------------------------------------------------------------------

function toLatin1(str) {
  const out = new Uint8Array(str.length)
  for (let i = 0; i < str.length; i++) {
    // Los textos en español (acentos, ñ, ©) entran en Latin-1; cualquier otro
    // carácter se reemplaza por '?' para mantener el chunk válido.
    const code = str.charCodeAt(i)
    out[i] = code <= 0xff ? code : 0x3f
  }
  return out
}

function concatBytes(parts) {
  let total = 0
  parts.forEach(p => { total += p.length })
  const out = new Uint8Array(total)
  let offset = 0
  parts.forEach(p => { out.set(p, offset); offset += p.length })
  return out
}

function ascii(bytes, start, end) {
  let s = ''
  for (let i = start; i < end; i++) s += String.fromCharCode(bytes[i])
  return s
}

let CRC_TABLE = null
function crc32(data) {
  if (!CRC_TABLE) {
    CRC_TABLE = new Uint32Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      CRC_TABLE[n] = c >>> 0
    }
  }
  let crc = 0xffffffff
  for (let i = 0; i < data.length; i++) crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function bytesToBase64(bytes) {
  let bin = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk))
  }
  return btoa(bin)
}

// ---------------------------------------------------------------------------
// TIFF/EXIF (formato clásico little-endian)
// ---------------------------------------------------------------------------

function exifDateTime(iso) {
  const d = new Date(iso)
  const pad = n => String(n).padStart(2, '0')
  // El estándar TIFF/EXIF NO usa ISO 8601 para el tag DateTime: exige
  // "YYYY:MM:DD HH:MM:SS". La variante ISO 8601 se escribe en el packet XMP
  // (xmp:CreateDate), que sí es ISO 8601 por definición.
  return `${d.getUTCFullYear()}:${pad(d.getUTCMonth() + 1)}:${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`
}

function buildExifTiff(meta) {
  const fields = []
  if (meta.software) fields.push({ tag: 0x0131, value: meta.software })
  if (meta.artist) fields.push({ tag: 0x013b, value: meta.artist })
  if (meta.copyright) fields.push({ tag: 0x8298, value: meta.copyright })
  if (meta.dateTime) fields.push({ tag: 0x0132, value: exifDateTime(meta.dateTime) })

  const n = fields.length
  const strings = fields.map(f => toLatin1(f.value + '\0'))
  const dataStart = 8 + 2 + n * 12 + 4
  let cursor = dataStart
  const stringOffsets = strings.map(s => { const o = cursor; cursor += s.length; return o })

  const out = new Uint8Array(cursor)
  const dv = new DataView(out.buffer)
  out[0] = 0x49 // "I"
  out[1] = 0x49 // "I"  -> little-endian TIFF
  dv.setUint16(2, 0x002a, true)          // TIFF magic
  dv.setUint32(4, 8, true)               // offset del IFD0
  dv.setUint16(8, n, true)               // cantidad de entradas
  let p = 10
  fields.forEach((f, i) => {
    dv.setUint16(p, f.tag, true)                 // tag
    dv.setUint16(p + 2, 2, true)                 // tipo 2 = ASCII
    dv.setUint32(p + 4, strings[i].length, true) // count (incluye el \0)
    dv.setUint32(p + 8, stringOffsets[i], true)  // offset del valor
    p += 12
  })
  dv.setUint32(p, 0, true) // next IFD = ninguno
  strings.forEach((s, i) => out.set(s, stringOffsets[i]))
  return out
}

// ---------------------------------------------------------------------------
// XMP (packet XML estándar de Adobe) — transporta la fecha en ISO 8601
// ---------------------------------------------------------------------------

function escXml(v) {
  return String(v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

function buildXmpPacket(meta) {
  let desc = ''
  if (meta.artist) desc += `<dc:creator><rdf:Seq><rdf:li>${escXml(meta.artist)}</rdf:li></rdf:Seq></dc:creator>\n`
  if (meta.title) desc += `<dc:title><rdf:Alt><rdf:li xml:lang="x-default">${escXml(meta.title)}</rdf:li></rdf:Alt></dc:title>\n`
  if (meta.copyright) {
    desc += `<dc:rights><rdf:Alt><rdf:li xml:lang="x-default">${escXml(meta.copyright)}</rdf:li></rdf:Alt></dc:rights>\n`
    desc += `<xmpRights:Marked>True</xmpRights:Marked>\n`
  }
  if (meta.software) desc += `<xmp:CreatorTool>${escXml(meta.software)}</xmp:CreatorTool>\n`
  if (meta.dateTime) desc += `<xmp:CreateDate>${escXml(meta.dateTime)}</xmp:CreateDate>\n`

  const xml = `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>\n` +
    `<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="${escXml(meta.software || '')}">\n` +
    ` <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">\n` +
    `  <rdf:Description rdf:about=""` +
    ` xmlns:dc="http://purl.org/dc/elements/1.1/"` +
    ` xmlns:xmp="http://ns.adobe.com/xap/1.0/"` +
    ` xmlns:xmpRights="http://ns.adobe.com/xap/1.0/rights/">\n` +
    `${desc}  </rdf:Description>\n` +
    ` </rdf:RDF>\n` +
    `</x:xmpmeta>\n` +
    `<?xpacket end="w"?>\n`
  return new TextEncoder().encode(xml)
}

// ---------------------------------------------------------------------------
// Inyección por formato
// ---------------------------------------------------------------------------

// PNG: se agregan chunks tEXt con las keywords estándar del spec PNG
// (Author, Copyright, Software, Creation Time, Title) justo después del IHDR.
function pngChunk(type, data) {
  const out = new Uint8Array(12 + data.length)
  const dv = new DataView(out.buffer)
  dv.setUint32(0, data.length)
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i)
  out.set(data, 8)
  dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)))
  return out
}

function injectPngText(png, entries) {
  const dv = new DataView(png.buffer, png.byteOffset, png.byteLength)
  if (ascii(png, 0, 8) !== '\x89PNG\r\n\x1a\n') return png
  const ihdrLen = dv.getUint32(8)
  const ihdrEnd = 8 + 12 + ihdrLen
  const chunks = entries.map(([key, value]) => {
    const k = toLatin1(key)
    const v = toLatin1(value)
    const data = new Uint8Array(k.length + 1 + v.length)
    data.set(k, 0)
    data[k.length] = 0
    data.set(v, k.length + 1)
    return pngChunk('tEXt', data)
  })
  return concatBytes([png.subarray(0, ihdrEnd), ...chunks, png.subarray(ihdrEnd)])
}

// JPEG: segmentos APP1 (EXIF + XMP) insertados tras los APP existentes (SOI/APP0).
function app1Segment(identifier, payload) {
  const id = toLatin1(identifier)
  const data = new Uint8Array(id.length + payload.length)
  data.set(id, 0)
  data.set(payload, id.length)
  const out = new Uint8Array(4 + data.length)
  const dv = new DataView(out.buffer)
  dv.setUint16(0, 0xffe1)                       // marker APP1
  dv.setUint16(2, 2 + data.length)              // largo (incluye los 2 bytes de largo)
  out.set(data, 4)
  return out
}

function injectJpegMetadata(jpeg, { exifTiff, xmp }) {
  const dv = new DataView(jpeg.buffer, jpeg.byteOffset, jpeg.byteLength)
  if (dv.getUint16(0) !== 0xffd8) return jpeg
  let pos = 2
  // Saltamos los segmentos APPn existentes para insertar los nuestros a continuación.
  while (pos + 4 <= jpeg.length) {
    const marker = dv.getUint16(pos)
    if ((marker & 0xff00) !== 0xff00) break
    const code = marker & 0xff
    if (code >= 0xe0 && code <= 0xef) {
      pos += 2 + dv.getUint16(pos + 2)
    } else {
      break
    }
  }
  const app1s = []
  if (exifTiff) app1s.push(app1Segment('Exif\0\0', exifTiff))
  if (xmp) app1s.push(app1Segment('http://ns.adobe.com/xap/1.0/\0', xmp))
  return concatBytes([jpeg.subarray(0, pos), ...app1s, jpeg.subarray(pos)])
}

// WebP: chunks EXIF y XMP dentro del contenedor RIFF, más flags del VP8X y
// el largo RIFF recalculado.
function webpChunk(fourCC, data) {
  const padded = data.length + (data.length & 1)
  const out = new Uint8Array(8 + padded)
  const dv = new DataView(out.buffer)
  for (let i = 0; i < 4; i++) out[i] = fourCC.charCodeAt(i)
  dv.setUint32(4, data.length, true)
  out.set(data, 8)
  return out
}

function injectWebpMetadata(input, { exifTiff, xmp }) {
  const webp = Uint8Array.from(input)
  const dv = new DataView(webp.buffer)
  if (ascii(webp, 0, 4) !== 'RIFF' || ascii(webp, 8, 12) !== 'WEBP') return webp

  const chunksToAdd = []
  if (exifTiff) chunksToAdd.push(webpChunk('EXIF', exifTiff))
  if (xmp) chunksToAdd.push(webpChunk('XMP ', xmp))
  if (!chunksToAdd.length) return webp

  // Recorremos los chunks para ubicar el VP8X (ahí van los flags de presencia)
  // y determinar el punto de inserción (después del VP8X).
  let insertAt = -1
  let pos = 12
  while (pos + 8 <= webp.length) {
    const cc = ascii(webp, pos, pos + 4)
    const size = dv.getUint32(pos + 4, true)
    const padded = size + (size & 1)
    if (cc === 'VP8X') {
      // byte de flags: bit 5 (0x20) = EXIF, bit 6 (0x40) = XMP
      const f = webp[pos + 8] || 0
      webp[pos + 8] = f | (exifTiff ? 0x20 : 0) | (xmp ? 0x40 : 0)
      if (insertAt < 0) insertAt = pos + 8 + padded
    }
    pos += 8 + padded
  }
  if (insertAt < 0) insertAt = webp.length

  let added = 0
  chunksToAdd.forEach(c => { added += c.length })
  const out = new Uint8Array(webp.length + added)
  out.set(webp.subarray(0, insertAt), 0)
  let o = insertAt
  chunksToAdd.forEach(c => { out.set(c, o); o += c.length })
  out.set(webp.subarray(insertAt), o)
  const outDv = new DataView(out.buffer)
  outDv.setUint32(4, out.length - 8, true) // RIFF size
  return out
}

// Dispatcher: recibe los bytes re-encodeados SIN metadatos y les adjunta el diccionario.
export function injectMetadata(bytes, format, meta) {
  if (format === 'png') {
    return injectPngText(bytes, [
      ['Title', meta.title],
      ['Author', meta.artist],
      ['Copyright', meta.copyright],
      ['Software', meta.software],
      ['Creation Time', meta.dateTime],
    ].filter(([, v]) => v))
  }
  const exif = buildExifTiff(meta)
  const xmp = buildXmpPacket(meta)
  if (format === 'jpeg') return injectJpegMetadata(bytes, { exifTiff: exif, xmp })
  if (format === 'webp') return injectWebpMetadata(bytes, { exifTiff: exif, xmp })
  return bytes
}

// ---------------------------------------------------------------------------
// Aislamiento de píxeles y flujo de exportación
// ---------------------------------------------------------------------------

function loadImageFromDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('no se pudo decodificar la imagen'))
    img.src = dataUrl
  })
}

// Re-renderiza la imagen sobre un canvas totalmente nuevo a resolución natural.
// El canvas usa EXACTAMENTE las dimensiones de origen (naturalWidth/Height), de modo
// que la relación de aspecto y la resolución se conservan sin escalar ni recortar.
// Todo encabezado/metadata del archivo fuente queda fuera: solo sobreviven los píxeles.
export async function renderToCanvas(dataUrl, { jpeg = false } = {}) {
  const img = await loadImageFromDataUrl(dataUrl)
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  if (!canvas.width || !canvas.height) throw new Error('la imagen no tiene dimensiones válidas')
  const ctx = canvas.getContext('2d')
  if (jpeg) {
    // JPEG no soporta transparencia: fondo blanco.
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }
  ctx.drawImage(img, 0, 0)
  return canvas
}

function canvasToBytes(canvas, format, quality) {
  return new Promise((resolve, reject) => {
    const mime = format === 'jpeg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png'
    canvas.toBlob(async blob => {
      if (!blob) return reject(new Error('no se pudo codificar la imagen'))
      try { resolve(new Uint8Array(await blob.arrayBuffer())) } catch (e) { reject(e) }
    }, mime, quality)
  })
}

export const FORMAT_EXT = { png: 'png', jpeg: 'jpg', webp: 'webp' }

export function slugify(str) {
  return String(str || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '') || 'tira'
}

// Núcleo: re-encode desde un canvas + inyección del diccionario + guardado con diálogo.
// quality=1 = máxima calidad (PNG es lossless; JPEG/WebP usan el mejor factor posible).
export async function exportCleanCanvas({ canvas, title, author, format = 'png', quality = 1, defaultName }) {
  const meta = buildExportMetadata({ author, title })
  const bytes = await canvasToBytes(canvas, format, format === 'png' ? undefined : quality)
  const injected = injectMetadata(bytes, format, meta)

  const filters = {
    png: [{ name: 'Imagen PNG', extensions: ['png'] }],
    jpeg: [{ name: 'Imagen JPEG', extensions: ['jpg', 'jpeg'] }],
    webp: [{ name: 'Imagen WebP', extensions: ['webp'] }],
  }[format]

  if (window.api?.dialog?.save) {
    const dlg = await window.api.dialog.save({
      defaultPath: defaultName || `${slugify(title)}.${FORMAT_EXT[format]}`,
      filters,
    })
    if (dlg.canceled || !dlg.filePath) return null
    if (window.api?.export?.save) {
      await window.api.export.save({ filePath: dlg.filePath, data: bytesToBase64(injected) })
      return { filePath: dlg.filePath, meta }
    }
    // Fallback navegador: descarga por anchor.
    const blob = new Blob([injected.buffer], { type: filters[0].extensions[0] === 'png' ? 'image/png' : filters[0].extensions[0] === 'jpg' ? 'image/jpeg' : 'image/webp' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = dlg.filePath.split('/').pop() || defaultName
    a.click()
    URL.revokeObjectURL(url)
    return { filePath: dlg.filePath, meta }
  }
  alert('reiniciá la app para activar la exportación limpia')
  return null
}

// Export de un resultado guardado: lee el path, aísla píxeles y exporta.
export async function exportCleanImage({ sourcePath, title, author, format = 'png', quality = 1, defaultName }) {
  if (!window.api?.references?.read) throw new Error('referencias no disponibles')
  const dataUrl = await window.api.references.read(sourcePath)
  if (!dataUrl) throw new Error('no se pudo leer la imagen de origen')
  const canvas = await renderToCanvas(dataUrl, { jpeg: format === 'jpeg' })
  return exportCleanCanvas({ canvas, title, author, format, quality, defaultName })
}
