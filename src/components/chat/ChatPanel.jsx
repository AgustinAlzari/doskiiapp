import { useEffect, useRef } from 'react'
import useChatStore from '../../store/chatStore'
import useMuseUiStore from '../../store/museUiStore'
import usePromptIterationStore from '../../store/promptIterationStore'
import useStripStore from '../../store/stripStore'
import ApiPreview from '../prompt/ApiPreview'

export default function ChatPanel() {
  const models = useChatStore(s => s.models)
  const favoriteModelId = useChatStore(s => s.favoriteModelId)
  const setFavorite = useChatStore(s => s.setFavorite)
  const chatOpen = useChatStore(s => s.open)
  const model = useChatStore(s => s.favoriteModel())
  const webviewRef = useRef(null)
  const areaRef = useRef(null)
  const museHasKey = useMuseUiStore(s => s.hasKey())
  const chatMode = useMuseUiStore(s => s.chatMode)
  const setChatMode = useMuseUiStore(s => s.setChatMode)
  const activeStripId = useMuseUiStore(s => s.activeStripId)
  const activePanelId = useMuseUiStore(s => s.activePanelId)
  const byPanel = usePromptIterationStore(s => s.byPanel)

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

  useEffect(() => {
    if (webviewRef.current) webviewRef.current.id = 'doski-chat-webview'
  }, [model?.url])

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

  const resetChat = () => {
    try { webviewRef.current?.reload() } catch {}
  }
  const closeChat = () => useChatStore.getState().setOpen(false)

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
      display: chatOpen ? 'flex' : 'none',
      flexDirection: 'column',
      paddingBottom: 10,
    }}>
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
        {museHasKey && chatMode === 'api' ? (
          <span className="ui-h2" style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>api preview</span>
        ) : (
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
        )}
        <span style={{ flex: 1 }} />
        {museHasKey && (
          <button
            onClick={() => setChatMode(chatMode === 'api' ? 'webview' : 'api')}
            title={chatMode === 'api' ? 'ver chat web' : 'ver api preview'}
            style={{ background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 6, padding: '2px 8px', fontSize: 11, cursor: 'pointer' }}
          >
            {chatMode === 'api' ? 'chat' : 'api'}
          </button>
        )}
        <button
          onClick={resetChat}
          title="reiniciar la conversación"
          style={{
            background: 'transparent',
            border: 'none',
            padding: '2px 6px',
            fontSize: 15,
            lineHeight: 1,
            cursor: 'pointer',
            color: 'var(--color-text-muted)',
            borderRadius: 4,
          }}
        >
          ⟳
        </button>
        <button
          onClick={closeChat}
          title="ocultar chat"
          style={{
            background: 'transparent',
            border: 'none',
            padding: '2px 6px',
            fontSize: 16,
            lineHeight: 1,
            cursor: 'pointer',
            color: 'var(--color-text-muted)',
            borderRadius: 4,
          }}
        >
          ×
        </button>
      </div>

      {museHasKey && chatMode === 'api' ? (
        (() => {
          const key = activeStripId && activePanelId ? `${activeStripId}:${activePanelId}` : null
          const entry = key ? byPanel[key] : null
          const iterations = entry?.scene.iterations || []
          const currentId = entry?.scene.currentId
          const approvedId = entry?.scene.approvedId
          const handleApprove = (id) => {
            usePromptIterationStore.getState().approve(activeStripId, activePanelId, 'scene', id)
            try {
              const it = (usePromptIterationStore.getState().byPanel[key]?.scene.iterations || []).find(x => x.id === id)
              if (it?.imagePath) {
                const strip = useStripStore.getState().strips.find(s => s.id === activeStripId)
                if (!strip) return
                const fileName = String(it.imagePath).split('/').pop()
                const next = [...(strip.results || []), { id: crypto.randomUUID(), fileName, path: it.imagePath, observations: `aprobado api ${it.model || ''}`, pasted: false }]
                const coverIdx = next.length - 1
                useStripStore.getState().save({ ...strip, results: next, resultCoverIndex: coverIdx })
              }
            } catch {}
          }
          return (
            <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 12 }}>
              {!key ? <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>abrí una viñeta en prompts para ver el preview api</div> : <ApiPreview iterations={iterations} currentId={currentId} approvedId={approvedId} onSelect={id => usePromptIterationStore.getState().setCurrent(activeStripId, activePanelId, 'scene', id)} onApprove={handleApprove} />}
            </div>
          )
        })()
      ) : model?.url ? (
        <div ref={areaRef} style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' }}>
          <webview
            id="doski-chat-webview"
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
