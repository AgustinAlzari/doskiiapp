import { useEffect, useRef, useState } from 'react'
import { COLOR_MODES, PALETTE_ROLES } from '../../store/projectStore'
import usePaletteStore from '../../store/paletteStore'

function normalizeHex(raw) {
  const t = String(raw || '').trim().replace(/^#/, '')
  if (/^[0-9a-fA-F]{3}$/.test(t)) return `#${t.split('').map(c => c + c).join('')}`
  if (/^[0-9a-fA-F]{6}$/.test(t)) return `#${t.toLowerCase()}`
  return null
}

function rgbToHex(r, g, b) {
  const to = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
  return `#${to(r)}${to(g)}${to(b)}`
}

function dominantColor(ctx, w, h) {
  const data = ctx.getImageData(0, 0, w, h).data
  const buckets = {}
  let best = null
  let bestCount = 0
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3]
    if (a < 128) continue
    const key = `${data[i] >> 4},${data[i + 1] >> 4},${data[i + 2] >> 4}`
    const count = (buckets[key] || 0) + 1
    buckets[key] = count
    if (count > bestCount) {
      bestCount = count
      const parts = key.split(',')
      best = rgbToHex((parts[0] << 4) | 8, (parts[1] << 4) | 8, (parts[2] << 4) | 8)
    }
  }
  return best
}

export default function PaletteEditor({ colors, colorMode, onModeChange, onColorsChange, paletteId, onPaletteIdChange }) {
  const palettes = usePaletteStore(s => s.palettes)
  const savePalette = usePaletteStore(s => s.save)
  const removePalette = usePaletteStore(s => s.remove)

  const current = palettes.find(p => p.id === paletteId) || null
  const [name, setName] = useState(current?.name || '')
  const [hexInput, setHexInput] = useState('')
  const [imgUrl, setImgUrl] = useState(null)
  const [imgResult, setImgResult] = useState(null)
  const [pickingPixel, setPickingPixel] = useState(false)
  const pickerCanvasRef = useRef(null)

  useEffect(() => {
    setName(current?.name || '')
  }, [paletteId]) // eslint-disable-line react-hooks/exhaustive-deps

  const updateColor = (id, updates) => onColorsChange(colors.map(c => c.id === id ? { ...c, ...updates } : c))

  const addColor = (hex) => {
    const normalized = normalizeHex(hex)
    if (!normalized) return false
    onColorsChange([...colors, { id: crypto.randomUUID(), hex: normalized, role: 'accent', label: '' }])
    return true
  }

  const removeColor = (id) => onColorsChange(colors.filter(c => c.id !== id))

  const addHexInput = () => {
    if (addColor(hexInput)) setHexInput('')
  }

  const pickWithEyeDropper = async () => {
    try {
      if (window.EyeDropper) {
        const ed = new window.EyeDropper()
        const result = await ed.open()
        if (result?.sRGBHex) addColor(result.sRGBHex)
        return
      }
    } catch (e) {
      // fallback al input color nativo
    }
    // fallback: input color
    const fallback = document.getElementById('palette-color-fallback')
    fallback?.click()
  }

  const loadImageUrl = (dataUrl) => {
    setImgUrl(dataUrl)
    setImgResult(null)
    setPickingPixel(false)
  }

  const pasteImage = async () => {
    try {
      const data = await window.api?.clipboard?.readImage?.()
      if (data?.dataUrl) loadImageUrl(data.dataUrl)
    } catch (e) {
      console.error('paste image:', e)
    }
  }

  const onDropImage = (e) => {
    e.preventDefault()
    const file = e.dataTransfer?.files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = () => loadImageUrl(reader.result)
    reader.readAsDataURL(file)
  }

  useEffect(() => {
    if (!imgUrl || !pickerCanvasRef.current) return
    const canvas = pickerCanvasRef.current
    const ctx = canvas.getContext('2d')
    const img = new Image()
    img.onload = () => {
      const maxW = 280
      const scale = Math.min(1, maxW / img.width)
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      const dom = dominantColor(ctx, canvas.width, canvas.height)
      setImgResult(dom ? { hex: dom, mode: 'dominante' } : null)
    }
    img.src = imgUrl
  }, [imgUrl])

  const onCanvasClick = (e) => {
    const canvas = pickerCanvasRef.current
    if (!canvas || !imgUrl) return
    const rect = canvas.getBoundingClientRect()
    const x = Math.round((e.clientX - rect.left) * (canvas.width / rect.width))
    const y = Math.round((e.clientY - rect.top) * (canvas.height / rect.height))
    const ctx = canvas.getContext('2d')
    const [r, g, b] = ctx.getImageData(x, y, 1, 1).data
    setImgResult({ hex: rgbToHex(r, g, b), mode: 'pixel' })
    setPickingPixel(false)
  }

  const saveToLibrary = async () => {
    const trimmed = name.trim()
    if (!trimmed) return
    const id = paletteId || crypto.randomUUID()
    const saved = await savePalette({
      id,
      name: trimmed,
      colors: colors.map(c => ({ ...c })),
      createdAt: current?.createdAt,
    })
    if (paletteId !== id) onPaletteIdChange?.(id)
    else onPaletteIdChange?.(id)
    return saved
  }

  const deleteFromLibrary = async () => {
    if (!paletteId) return
    if (!confirm(`¿Eliminar la paleta "${name}" de la biblioteca?`)) return
    await removePalette(paletteId)
    onPaletteIdChange?.(null)
    setName('')
  }

  const openPalette = (id) => {
    onPaletteIdChange?.(id)
  }

  const newPalette = () => {
    onPaletteIdChange?.(null)
    setName('')
    onColorsChange([])
  }

  const applyPaletteColors = (id) => {
    const target = palettes.find(p => p.id === id)
    if (target) onColorsChange(target.colors.map(c => ({ ...c })))
  }

  const canEyeDropper = typeof window !== 'undefined' && 'EyeDropper' in window

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <label className="label">modo de color</label>
        <div className="radio-group">
          {COLOR_MODES.map(mode => (
            <div
              key={mode.id}
              className={`radio-pill ${colorMode === mode.id ? 'active' : ''}`}
              onClick={() => onModeChange(mode.id)}
              title={mode.label}
            >
              {mode.label}
            </div>
          ))}
        </div>
      </div>

      {/* Biblioteca */}
      <div style={{ border: '1px solid var(--color-border)', borderRadius: 6, padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <label className="label" style={{ marginBottom: 0 }}>biblioteca de paletas</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <select
            className="input"
            value={paletteId || ''}
            onChange={e => { if (e.target.value) { applyPaletteColors(e.target.value); openPalette(e.target.value) } }}
            style={{ fontSize: 11, flex: 1, cursor: 'pointer', minWidth: 120 }}
          >
            <option value="">— abrir paleta —</option>
            {palettes.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <button className="btn btn-sm btn-ghost" onClick={newPalette} style={{ fontSize: 11 }}>nueva</button>
          <button className="btn btn-sm" onClick={saveToLibrary} disabled={!name.trim()} style={{ fontSize: 11 }}>guardar en biblioteca</button>
          {paletteId && (
            <button className="btn btn-ghost btn-sm btn-danger" onClick={deleteFromLibrary} style={{ fontSize: 11 }}>×</button>
          )}
        </div>
        <input
          className="input"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="nombre de la paleta (ej: tierra otoño)"
          style={{ fontSize: 11 }}
        />
        {paletteId && current && (
          <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>
            paleta compartida: los cambios se guardan en la biblioteca y afectan a todos los proyectos que la usan.
          </div>
        )}
      </div>

      {colorMode !== 'bw' && (
        <>
          {colors.length > 0 && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {colors.filter(c => c.hex).map(c => (
                <div
                  key={c.id}
                  style={{ width: 20, height: 20, borderRadius: 4, background: c.hex, border: '1px solid var(--color-border)', cursor: 'pointer' }}
                  title={c.label || c.hex}
                  onClick={() => updateColor(c.id, { role: 'accent' })}
                />
              ))}
            </div>
          )}

          {/* Captura de color */}
          <div style={{ border: '1px dashed var(--color-border)', borderRadius: 6, padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label className="label" style={{ marginBottom: 0 }}>agregar color</label>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                className="input"
                value={hexInput}
                onChange={e => setHexInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addHexInput() }}
                placeholder="hex sin # (ej: FF6600)"
                style={{ fontSize: 11, flex: 1, minWidth: 140 }}
              />
              <button className="btn btn-sm" onClick={addHexInput} style={{ fontSize: 11 }}>agregar</button>
              {canEyeDropper ? (
                <button className="btn btn-sm btn-ghost" onClick={pickWithEyeDropper} style={{ fontSize: 11 }} title="cuentagotas">🩸 cuentagotas</button>
              ) : (
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, cursor: 'pointer' }}>
                  <input id="palette-color-fallback" type="color" onChange={e => addColor(e.target.value)} style={{ width: 24, height: 24, border: 'none', padding: 0, cursor: 'pointer' }} />
                  color
                </label>
              )}
              <button className="btn btn-sm btn-ghost" onClick={pasteImage} style={{ fontSize: 11 }} title="pegar imagen del portapapeles">pegar imagen</button>
            </div>

            <div
              onDragOver={e => e.preventDefault()}
              onDrop={onDropImage}
              style={{ border: '1px solid var(--color-border)', borderRadius: 5, padding: 8, fontSize: 10, color: 'var(--color-text-muted)', cursor: 'copy' }}
            >
              arrastrá una imagen acá para extraer su color dominante, o pegá una imagen (⌘V)
            </div>

            {imgUrl && (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <div style={{ flex: '1 1 180px', minWidth: 180 }}>
                  <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginBottom: 3 }}>
                    {pickingPixel ? 'hacé clic en un pixel de la imagen' : 'vista previa (hacé clic para elegir pixel)'}
                  </div>
                  <div style={{ border: '1px solid var(--color-border)', borderRadius: 5, padding: 4, background: 'white', display: 'inline-block' }}>
                    <canvas
                      ref={pickerCanvasRef}
                      onClick={onCanvasClick}
                      style={{ cursor: pickingPixel ? 'crosshair' : 'pointer', maxWidth: 280, display: 'block' }}
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
                  {imgResult && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 22, height: 22, borderRadius: 4, background: imgResult.hex, border: '1px solid var(--color-border)' }} />
                      <span style={{ fontSize: 11, fontFamily: 'monospace' }}>{imgResult.hex}</span>
                      <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>({imgResult.mode === 'dominante' ? 'dominante' : 'pixel'})</span>
                    </div>
                  )}
                  {imgResult && (
                    <button className="btn btn-sm" onClick={() => { if (addColor(imgResult.hex)) setImgUrl(null) }} style={{ fontSize: 11 }}>
                      agregar color
                    </button>
                  )}
                  <button className="btn btn-sm btn-ghost" onClick={() => setPickingPixel(p => !p)} style={{ fontSize: 11 }}>
                    {pickingPixel ? 'listo' : 'elegir pixel'}
                  </button>
                  <button className="btn btn-sm btn-ghost" onClick={() => setImgUrl(null)} style={{ fontSize: 11 }}>descartar</button>
                </div>
              </div>
            )}
          </div>

          {colors.map(color => (
            <div key={color.id} style={{ border: '1px solid var(--color-border)', borderRadius: 6, padding: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="color"
                value={color.hex}
                onChange={e => updateColor(color.id, { hex: e.target.value })}
                style={{ width: 30, height: 30, border: 'none', borderRadius: 4, cursor: 'pointer', padding: 0, flexShrink: 0 }}
              />
              <input
                className="input"
                value={color.hex}
                onChange={e => { const h = normalizeHex(e.target.value); if (h) updateColor(color.id, { hex: h }) }}
                style={{ fontSize: 11, width: 76, fontFamily: 'monospace', flexShrink: 0 }}
              />
              <select
                className="input"
                value={color.role}
                onChange={e => updateColor(color.id, { role: e.target.value })}
                style={{ fontSize: 11, cursor: 'pointer', flexShrink: 0 }}
              >
                {PALETTE_ROLES.map(role => (
                  <option key={role.id} value={role.id}>{role.label}</option>
                ))}
              </select>
              <input
                className="input"
                value={color.label || ''}
                onChange={e => updateColor(color.id, { label: e.target.value })}
                placeholder="etiqueta (ej: rojo chaqueta)"
                style={{ fontSize: 11, flex: 1 }}
              />
              <button className="btn btn-ghost btn-sm btn-danger" onClick={() => removeColor(color.id)} style={{ fontSize: 10 }}>×</button>
            </div>
          ))}

          <button className="btn btn-sm btn-ghost" onClick={() => addColor('#111111')} style={{ fontSize: 11, alignSelf: 'flex-start' }}>
            + agregar color
          </button>
        </>
      )}
    </div>
  )
}
