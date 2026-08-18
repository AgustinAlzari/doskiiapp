import { useEffect } from 'react'
import useToastStore from '../store/toastStore'

export default function AutoSaveToast() {
  const toast = useToastStore(s => s.toast)
  const hide = useToastStore(s => s.hide)

  useEffect(() => {
    if (!toast) return
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        toast.undo?.()
        hide()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toast, hide])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(hide, 6000)
    return () => clearTimeout(t)
  }, [toast, hide])

  if (!toast) return null

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 18,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10002,
        background: 'var(--color-text)',
        color: '#fff',
        fontSize: 12,
        padding: '8px 14px',
        borderRadius: 8,
        boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        maxWidth: '92vw',
      }}
    >
      <span>{toast.message}</span>
      <button
        onClick={() => { toast.undo?.(); hide() }}
        style={{
          background: 'transparent',
          border: '1px solid rgba(255,255,255,0.5)',
          color: '#fff',
          borderRadius: 6,
          fontSize: 11,
          padding: '3px 10px',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        deshacer
      </button>
    </div>
  )
}