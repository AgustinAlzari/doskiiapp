import { create } from 'zustand'

const useToastStore = create((set) => ({
  toast: null,
  show: (toast) => set({ toast }),
  hide: () => set({ toast: null }),
}))

export default useToastStore