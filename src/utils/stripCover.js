// Portada de una viñeta: una sola regla para que la misma viñeta muestre la
// misma imagen en todas las vistas (mosaico, viñetas, tira).
// - sin resultados → null
// - resultCoverIndex === -1 (destildada) → null (sin portada)
// - resultCoverIndex sin definir → último resultado
// - índice válido → ese resultado
export function coverOf(strip) {
  const results = strip?.results || []
  if (results.length === 0) return null
  const ci = strip?.resultCoverIndex
  if (ci === -1) return null
  const idx = Math.min(Math.max(0, ci == null ? results.length - 1 : ci), results.length - 1)
  return results[idx] || null
}

// Clave estable por viñeta:resultado, para cachear la imagen por portada real
// (si cambia la portada, la clave cambia y la imagen se recarga sola).
export function coverKeyOf(strip) {
  const r = coverOf(strip)
  return r ? `${strip.id}:${r.id}` : `${strip.id}:none`
}