import { create } from 'zustand'
import { getMuseSecrets } from '../services/museSecrets'

const useMuseUiStore = create((set, get) => ({
  viaByKey: JSON.parse(localStorage.getItem('doski:museVia') || '{}'),
  selectedModel: localStorage.getItem('doski:museModel') || 'muse-image-1.0',
  // chatMode global para transformar ChatPanel en ApiPreview cuando via API
  chatMode: localStorage.getItem('doski:museChatMode') || 'webview', // 'api' | 'webview'
  // panel activo para ApiPreview
  activeStripId: null,
  activePanelId: null,

  getVia: (k) => get().viaByKey[k] || 'chatbot',
  setVia: (k, via) => {
    const next = { ...get().viaByKey, [k]: via }
    set({ viaByKey: next })
    try { localStorage.setItem('doski:museVia', JSON.stringify(next)) } catch {}
  },

  getModel: () => get().selectedModel,
  setModel: (m) => {
    set({ selectedModel: m })
    try { localStorage.setItem('doski:museModel', m) } catch {}
  },

  getChatMode: () => get().chatMode,
  setChatMode: (m) => {
    set({ chatMode: m })
    try { localStorage.setItem('doski:museChatMode', m) } catch {}
  },

  setActivePanel: (stripId, panelId) => set({ activeStripId: stripId, activePanelId: panelId }),

  reasoningEffort: localStorage.getItem('doski:museReasoning') || 'medium',
  setReasoningEffort: (v) => {
    set({ reasoningEffort: v })
    try { localStorage.setItem('doski:museReasoning', v) } catch {}
  },

  hasKey: () => !!getMuseSecrets().apiKey,
}))

export default useMuseUiStore
