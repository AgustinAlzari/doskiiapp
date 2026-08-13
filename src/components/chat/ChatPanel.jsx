import { useEffect, useRef, useState } from 'react'
import useChatStore from '../../store/chatStore'

export default function ChatPanel() {
  const models = useChatStore(s => s.models)
  const favoriteModelId = useChatStore(s => s.favoriteModelId)
  const setFavorite = useChatStore(s => s.setFavorite)
  const model = useChatStore(s => s.favoriteModel())
  const webviewRef = useRef(null)
  const areaRef = useRef(null)

  useEffect(() => {
    const wv = webviewRef.current
    if (!wv) return
    const onNewWindow = (e) => {
      e.preventDefault()
      if (window.api?.chat?.openExternal) window.api.chat.openExternal(e.url)
    }
    wv.addEventListener('new-window', onNewWindow)
    return () => wv.removeEventListener('new-window', onNewWindow)
  }, [webviewRef.current])

  // Dimensiona el webview con píxeles exactos (redondeados) para que su altura sea
  // estable: evita que la barra inferior del chat se recorte o titile bajo el cursor.
  useEffect(() => {
    const wv = webviewRef.current
    const area = areaRef.current
    if (!wv || !area) return
    const apply = () => {
      wv.style.width = '100%'
      wv.style.height = `${Math.round(area.getBoundingClientRect().height)}px`
    }
    apply()
    const ro = new ResizeObserver(apply)
    ro.observe(area)
    return () => ro.disconnect()
  }, [])

  return (
    <div style={{
      position: 'fixed',
      top: 48,
      right: 0,
      bottom: 0,
      width: 520,
      zIndex: 40,
      background: 'var(--color-bg)',
      borderLeft: '1px solid var(--color-border)',
      display: 'flex',
      flexDirection: 'column',
      paddingBottom: 10,
    }}>
      {/* Encabezado alineado con el de prompts */}
      <div
        className="editor-header"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          minHeight: 28,
          padding: '0 32px 12px',
          borderBottom: '1px solid var(--color-border-muted)',
          flexShrink: 0,
        }}
      >
        <span className="ui-h2" style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
          modelo
        </span>
        <select
          className="ui-h2"
          value={favoriteModelId}
          onChange={e => setFavorite(e.target.value)}
          style={{
            border: 'none',
            background: 'transparent',
            padding: 0,
            height: 28,
            cursor: 'pointer',
            flexShrink: 0,
          }}
          title="elegí el modelo de IA (favorito)"
        >
          {models.map(m => <option key={m.id} value={m.id}>{String(m.name).toLowerCase()}</option>)}
        </select>
      </div>

      {/* Chat embarcado */}
      {model?.url ? (
        <div ref={areaRef} style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' }}>
          <webview
            ref={webviewRef}
            src={model.url}
            style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' }}
            allowpopups="true"
          />
        </div>
      ) : (
        <div style={{ padding: 16, fontSize: 12, color: 'var(--color-text-muted)' }}>agregá un modelo en la sección "modelo" del menú</div>
      )}
    </div>
  )
}
