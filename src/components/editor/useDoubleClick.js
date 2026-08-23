import { useRef } from 'react'

// Detección manual de doble clic. El doble clic nativo no siempre se dispara
// cuando el primer clic arranca un drag (mousedown + listeners en window), así
// que se detecta por tiempo/distancia entre dos mousedown consecutivos.
// Devuelve un handler para usar dentro de handleMouseDown: si fue doble clic,
// llama `onDoubleClick` y devuelve true (para cortar el flujo del primer clic).
export default function useDoubleClick(onDoubleClick) {
  const lastRef = useRef({ t: 0, x: 0, y: 0 })
  return (e) => {
    if (!onDoubleClick) return false
    const now = Date.now()
    const last = lastRef.current
    const near = Math.hypot(e.clientX - last.x, e.clientY - last.y) < 10
    if (now - last.t < 400 && near) {
      lastRef.current = { t: 0, x: 0, y: 0 }
      onDoubleClick()
      return true
    }
    lastRef.current = { t: now, x: e.clientX, y: e.clientY }
    return false
  }
}