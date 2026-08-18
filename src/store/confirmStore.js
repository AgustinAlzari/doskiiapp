import { create } from 'zustand'

const useConfirmStore = create((set, get) => ({
  open: false,
  message: '',
  confirmLabel: 'confirmar',
  ask: (message, opts = {}) => new Promise((resolve) => {
    set({ open: true, message, confirmLabel: opts.confirmLabel || 'confirmar', resolve })
  }),
  respond: (ok) => {
    const { resolve } = get()
    if (resolve) resolve(ok)
    set({ open: false, message: '', confirmLabel: 'confirmar', resolve: null })
  },
}))

export const askConfirm = (message, opts) => useConfirmStore.getState().ask(message, opts)

export default useConfirmStore