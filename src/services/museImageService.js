// museImageService.js — image_generation solo, via api.meta.ai/v1/responses
// usa fetch directo para evitar incompatibilidad de SDK (openai 4.x no tiene responses, 7.x requiere Node 22)

function getBaseUrl(provider) {
  if (provider === 'zen') return 'https://opencode.ai/zen/v1'
  return 'https://api.meta.ai/v1'
}

export async function generateMuseImage({ apiKey, provider = 'meta', model = 'muse-image-1.0', promptText, imageDataUrls = [], previousResponseId = null, layoutFileName = null, reasoningEffort = null }) {
  if (!apiKey) throw new Error('falta MODEL_API_KEY')
  if (!promptText) throw new Error('falta prompt')

  const content = [{ type: 'input_text', text: promptText }]
  for (const url of imageDataUrls) {
    if (!url || !String(url).startsWith('data:')) continue
    content.push({ type: 'input_image', image_url: url })
  }

  const payload = { model, input: [{ role: 'user', content }], store: true }
  if (previousResponseId) payload.previous_response_id = previousResponseId
  if (layoutFileName) payload.metadata = { layout: layoutFileName }
  if (reasoningEffort && reasoningEffort !== 'auto') payload.reasoning = { effort: reasoningEffort }

  const url = `${getBaseUrl(provider)}/responses`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  })
  const text = await res.text()
  let json
  try { json = text ? JSON.parse(text) : null } catch { throw new Error(`respuesta no json: ${text.slice(0, 300)}`) }
  if (!res.ok) {
    const msg = json?.error?.message || json?.message || text.slice(0, 500)
    throw new Error(`muse api ${res.status}: ${msg}`)
  }
  return json
}

export async function refineMuseImage({ apiKey, provider, model, previousResponseId, correctionText }) {
  if (!previousResponseId) throw new Error('falta previous_response_id para refinar')
  return generateMuseImage({ apiKey, provider, model, promptText: correctionText, imageDataUrls: [], previousResponseId })
}

export function extractImageResult(response) {
  if (!response || !Array.isArray(response.output)) throw new Error('respuesta sin output')
  const call = response.output.find(o => o.type === 'image_generation_call')
  if (!call) throw new Error('no se encontró image_generation_call en la respuesta')
  const b64 = call.result || call.image || call.data
  if (!b64) throw new Error('image_generation_call sin result')
  // b64 es base64 puro (sin data: prefix)
  const id = response.id
  const usage = response.usage || null
  return { base64: b64, responseId: id, usage, callId: call.id, status: response.status }
}

export function buildDataUrlFromBase64(b64, mime = 'image/webp') {
  const clean = String(b64).replace(/^data:[^,]+,/, '')
  return `data:${mime};base64,${clean}`
}
