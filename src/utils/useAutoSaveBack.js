import { useCallback } from 'react'
import useToastStore from '../store/toastStore'

const diffFields = (next, stored, fields) =>
  fields.some(k => JSON.stringify(next?.[k]) !== JSON.stringify(stored?.[k]))

// Al tocar la flecha ←: si hay contenido con nombre, guarda automáticamente y
// muestra un aviso con opción de deshacer (Ctrl+Z en ese instante).
export default function useAutoSaveBack({ save, remove, payload, fields, hasContent, getStored, onBack }) {
  const show = useToastStore(s => s.show)

  const goBack = useCallback(async () => {
    const next = payload()
    const stored = hasContent && next?.id ? getStored(next.id) : null
    if (hasContent && next?.id && diffFields(next, stored, fields)) {
      try {
        await save(next)
      } catch (e) {
        console.error('autosave falló:', e)
        onBack()
        return
      }
      show({
        message: 'guardado automático — si no lo deseás, ctrl+z para deshacer',
        undo: () => {
          if (stored) {
            save(stored).catch(() => {})
          } else if (remove) {
            remove(next.id).catch(() => {})
          }
        },
      })
    }
    onBack()
  }, [save, remove, payload, fields, hasContent, getStored, onBack, show])

  return { goBack }
}