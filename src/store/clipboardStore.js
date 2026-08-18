import { create } from 'zustand'

// Portapapeles interno para copiar/pegar viñetas dentro de una tira con ⌘C/⌘V.
const useClipboardStore = create((set) => ({
  copiedStripId: null,
  copy: (stripId) => set({ copiedStripId: stripId }),
  clear: () => set({ copiedStripId: null }),
}))

export default useClipboardStore
