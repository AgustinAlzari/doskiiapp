import { useEffect, useRef, useState } from 'react'
import { exportCleanImage, slugify, FORMAT_EXT } from '../services/imageExport'
import ImagePreview from './ImagePreview'

const FORMATS = [
  { id: 'png', label: 'PNG', quality: undefined },
  { id: 'jpeg', label: 'JPEG', quality: 1 },
  { id: 'webp', label: 'WebP', quality: 1 },
]

// Galería flotante: lugar "sagrado" y mínimo donde se ve el resultado del trabajo.
// Los dibujos flotan uno al lado del otro a tamaño natural, cada uno en su caja
// sin contorno. Clic en un dibujo → preview completo. Barra superior con "ver"
// y "exportar" (una o todas).
export default function GalleryPreview({ items, author, onClose }) {
  const [fullIndex, setFullIndex] = useState(null)
  const [exportOpen, setExportOpen] = useState(false)
  const [exporting, setExporting] = useState(null)
  const [format, setFormat] = useState('png')
  const exportRef = useRef(null)

  // Esc cierra la galería (solo si no hay preview abierto encima).
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && fullIndex == null) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [fullIndex, onClose])

  // Cierra el menú "exportar" al hacer clic afuera.
  useEffect(() => {
    if (!exportOpen) return
    const onDown = (e) => {
      if (exportRef.current && !exportRef.current.contains(e.target)) setExportOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [exportOpen])

  const doExport = async (item, i) => {
    const f = FORMATS.find(x => x.id === format)
    const defaultName = `${slugify(item.stripTitle)}-result${item.resultNum}.${FORMAT_EXT[format]}`
    return exportCleanImage({
      sourcePath: item.path,
      title: item.stripTitle,
      author,
      format,
      quality: f?.quality,
      defaultName,
    })
  }

  const exportOne = async (item, i) => {
    setExportOpen(false)
    setExporting(i)
    try { await doExport(item, i) } catch (e) { console.error('export falló:', e) }
    setExporting(null)
  }

  const exportAll = async () => {
    setExportOpen(false)
    setExporting('all')
    for (let i = 0; i < items.length; i++) {
      const res = await doExport(items[i], i)
      if (!res) break // el usuario canceló el diálogo
    }
    setExporting(null)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#fff', zIndex: 10000, display: 'flex', flexDirection: 'column' }}>
      {/* Barra superior mínima */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', borderBottom: '1px solid var(--color-border-muted)', flexShrink: 0 }}>
        <button className="back-arrow" onClick={onClose} title="volver atrás (Esc)">←</button>
        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text)', whiteSpace: 'nowrap' }}>ver</span>
        <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
          {items.length} {items.length === 1 ? 'resultado' : 'resultados'}
        </span>
        <div style={{ flex: 1 }} />

        <div style={{ position: 'relative' }} ref={exportRef}>
          <button className="btn btn-sm" onClick={() => setExportOpen(v => !v)} disabled={exporting != null}>
            {exporting === 'all' ? 'exportando...' : exporting != null ? 'exportando...' : 'exportar'}
          </button>
          {exportOpen && (
            <div style={{
              position: 'absolute',
              right: 0,
              top: 'calc(100% + 6px)',
              zIndex: 10,
              minWidth: 220,
              background: 'var(--color-bg)',
              border: '1px solid var(--color-border)',
              borderRadius: 8,
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
              padding: 10,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)' }}>formato</div>
              <div className="radio-group">
                {FORMATS.map(f => (
                  <div
                    key={f.id}
                    className={`radio-pill ${format === f.id ? 'active' : ''}`}
                    onClick={() => setFormat(f.id)}
                  >
                    {f.label}
                  </div>
                ))}
              </div>
              <div style={{ width: '100%', height: 1, background: 'var(--color-border-muted)', margin: '4px 0' }} />
              <button className="btn btn-sm" onClick={exportAll} disabled={exporting != null}>
                exportar todas ({items.length})
              </button>
              <div style={{ width: '100%', height: 1, background: 'var(--color-border-muted)', margin: '4px 0' }} />
              {items.map((item, i) => (
                <button key={i} className="btn btn-ghost btn-sm" style={{ justifyContent: 'flex-start' }} onClick={() => exportOne(item, i)} disabled={exporting != null}>
                  {i + 1} · {item.stripTitle}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Galería flotante */}
      <div style={{ flex: 1, overflow: 'auto', padding: 28, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'flex-start', gap: 22, alignContent: 'flex-start' }}>
        {items.map((item, i) => (
          <div
            key={i}
            style={{
              background: 'var(--color-surface)',
              borderRadius: 12,
              padding: 10,
              boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
            }}
          >
            <img
              src={item.src}
              alt=""
              draggable={false}
              onClick={() => setFullIndex(i)}
              style={{
                maxHeight: '55vh',
                maxWidth: '100%',
                objectFit: 'contain',
                display: 'block',
                cursor: 'zoom-in',
                userSelect: 'none',
              }}
            />
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 8, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.title}
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <div style={{ color: 'var(--color-text-muted)', fontSize: 13, padding: 40 }}>sin resultados para mostrar.</div>
        )}
      </div>

      {/* Preview completo de una imagen */}
      {fullIndex != null && (
        <ImagePreview
          gallery={items}
          index={fullIndex}
          onIndex={(i) => setFullIndex((i + items.length) % items.length)}
          onClose={() => setFullIndex(null)}
        />
      )}
    </div>
  )
}
