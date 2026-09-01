import { DIALOGUE_TYPES, DIRECTIONS, DIRECTION_MODES, DIRECTION_MODE_HAS_GAZE, SHOT_TYPES, HATCH_TYPES, TIME_TRANSITIONS, MOTION_LINE_DESCS, ACTION_EFFECTS, ASPECT_RATIOS } from '../data/actionPresets'
import { balloonLawsToPrompt, balloonLawDiffSentences, lawsEqual, makeDefaultBalloonLaws } from '../data/balloonLaws'
import { markdownPromptParts, layoutPrompt, DEFAULT_ALIGN } from './markdown'

function describePosition(x = 0, y = 0, width = 0, height = 0) {
  const centerX = x + width / 2
  const centerY = y + height / 2
  const horizontal = centerX < 0.33 ? 'left' : centerX > 0.66 ? 'right' : 'center'
  const vertical = centerY < 0.33 ? 'top' : centerY > 0.66 ? 'bottom' : 'middle'
  const area = width * height
  const size = area < 0.04 ? 'very small' : area < 0.08 ? 'small' : area < 0.18 ? 'medium' : area < 0.3 ? 'large' : 'dominant'
  return { position: `${vertical} ${horizontal}`, size }
}

function describeLandscapePlacement(background) {
  const { x = 0, y = 0, width = 1, height = 0.5 } = background
  const centerX = x + width / 2
  const centerY = y + height / 2
  const area = width * height

  if (area >= 0.42 && width >= 0.65) {
    return 'Immersive, full-scene landscape. Characters and objects exist WITHIN this space, surrounded by it. The landscape extends to all edges and continues beyond the frame. Do NOT treat it as a floating image, card, or framed element.'
  }
  if (centerY >= 0.62) {
    if (centerX < 0.35) return 'Foreground landscape on the left, extending from the left edge. Characters are inside this space, not in front of an image.'
    if (centerX > 0.65) return 'Foreground landscape on the right, extending from the right edge. Characters are inside this space, not in front of an image.'
    return 'Foreground landscape at the bottom, extending from the lower edge. Characters are inside this space, not in front of an image.'
  }
  if (centerY <= 0.4 && area < 0.42) {
    return 'Distant background at the top, fading toward the upper edge. Does not surround characters.'
  }
  return 'Partial landscape integrated into the scene, limited to the indicated area. Extends naturally without visible borders or frames.'
}

function coordinates(item) {
  return `x ${Math.round(item.x * 100)}%, y ${Math.round(item.y * 100)}%, w ${Math.round(item.width * 100)}%, h ${Math.round(item.height * 100)}%`
}

function framePlacementText(item) {
  const { x = 0, y = 0, width = 0, height = 0 } = item
  const fullyLeft = x + width <= 0
  const fullyRight = x >= 1
  const fullyTop = y + height <= 0
  const fullyBottom = y >= 1
  const partially = x < 0 || y < 0 || x + width > 1 || y + height > 1
  const centerX = Math.round((x + width / 2) * 100)
  const centerY = Math.round((y + height / 2) * 100)

  if (fullyLeft || fullyRight || fullyTop || fullyBottom) {
    const outLeft = fullyLeft ? -(x + width) : 0
    const outRight = fullyRight ? x - 1 : 0
    const outTop = fullyTop ? -(y + height) : 0
    const outBottom = fullyBottom ? y - 1 : 0
    const max = Math.max(outLeft, outRight, outTop, outBottom)
    let edge
    if (max === outRight) edge = 'RIGHT'
    else if (max === outLeft) edge = 'LEFT'
    else if (max === outBottom) edge = 'BOTTOM'
    else edge = 'TOP'
    return `OFF-PANEL (entirely outside the frame). Positioned to the ${edge} of the panel: center at x ${centerX}%, y ${centerY}%. Draw it completely out of the frame, as if it continues beyond the panel edge.`
  }
  if (partially) {
    let edge
    if (x < 0) edge = 'LEFT'
    else if (x + width > 1) edge = 'RIGHT'
    else if (y < 0) edge = 'TOP'
    else edge = 'BOTTOM'
    return `PARTIALLY OFF-PANEL: enters from the ${edge} edge, partly outside the frame; only the visible part inside the panel edge is drawn. Center at x ${centerX}%, y ${centerY}%.`
  }
  return ''
}

function connectionTargetName(connection, characters, objects, backgrounds = []) {
  if ((connection.toType || 'character') === 'object') {
    return objects.find(item => item.id === connection.to)?.name
  }
  if ((connection.toType || 'character') === 'background') {
    return backgrounds.find(item => item.id === connection.to)?.name
  }
  return characters.find(item => item.id === connection.to)?.name
}

function referenceText(entity) {
  return entity.referenceImages?.length
    ? ` Visual reference attached: ${entity.referenceImages.map(image => image.fileName).join(', ')}. Use to preserve identity, form, materials, and distinctive features.`
    : ''
}

function cleanPromptText(text) {
  return (text || '').trim().replace(/[.\s]+$/, '')
}

export function projectStyleText(project) {
  if (!project) return ''
  const parts = []
  if (project.genre) parts.push(`Genre/tone: ${project.genre}`)
  if (project.drawingStyle) parts.push(`Drawing style: ${project.drawingStyle}`)
  if (project.world) parts.push(`Setting/world: ${project.world}`)
  if (project.styleNotes) parts.push(project.styleNotes)
  return parts.join('. ')
}

function combineStyleText(projectStyle, generalStyle) {
  const ps = (projectStyle || '').trim().replace(/[.\s]+$/, '')
  if (ps && generalStyle) return `${ps}. ${generalStyle}`
  return ps || generalStyle || ''
}

export function paletteText(project, paletteColors) {
  if (!project) return ''
  if (project.colorMode === 'bw') return 'COLOR PALETTE: pure black ink on white paper — black-and-white line art. Draw with solid black strokes and solid black ink accents only. NO gray midtones, NO gray fills, NO flat gray areas, NO shading with gray tones, NO color.'
  const colors = (paletteColors || project.palette || []).filter(c => c.hex)
  if (!colors.length) return ''
  const parts = colors.map(c => `${c.label || c.role}: ${c.hex}`)
  const modeLabel = project.colorMode === 'duotone'
    ? 'DUOTONE PALETTE (use only these tones):'
    : project.colorMode === 'limited'
      ? 'LIMITED COLOR PALETTE:'
      : 'COLOR PALETTE:'
  return `${modeLabel} ${parts.join(', ')}.`
}

function resolveAspectRatio(stripAspectRatio, project) {
  return stripAspectRatio || project?.defaultAspectRatio || 'hd'
}

const BALLOON_LABELS = {
  narration: 'narración',
  speech: 'diálogo',
  thought: 'pensamiento',
  other: 'globo x',
  image: 'imagen',
}

const DIALOGUE_TYPE_LABELS = {
  speech: 'speech',
  thought: 'thought',
  shout: 'shout',
  whisper: 'whisper',
}

function dialoguePlacementText(d) {
  const cx = Math.round((d.x + d.width / 2) * 100)
  const cy = Math.round((d.y + d.height / 2) * 100)
  const zone = cy < 33 ? 'in the upper area' : cy > 66 ? 'in the lower area' : 'in the middle area'
  return `${zone} (balloon center at x ${cx}%, y ${cy}%)`
}

function bubbleSideFromHead(balloon, ch) {
  if (!ch || !balloon) return ''
  const bx = balloon.x + (balloon.width || 0) / 2
  const hx = ch.x + (ch.width || 0) / 2
  return bx < hx ? 'UPPER-LEFT' : 'UPPER-RIGHT'
}

function channelStyleText(type) {
  if (type === 'thought') return ' Render it as a thought cloud, with smaller, italic lettering.'
  if (type === 'whisper') return ' Render it as whispered dialogue: smaller and italic.'
  if (type === 'shout') return ' Render it as a shout: larger and bolder lettering, punchy.'
  return ''
}

export function orderedPanelDialogues(panel, characters = [], opts = {}) {
  const includeEmpty = opts.includeEmpty === true
  const panelCharacters = panel?.characters || []
  const occurrences = new Map()
  const typeName = (id) => DIALOGUE_TYPES.find(v => v.id === id)?.id || 'speech'

  const stackCount = new Map()
  panelCharacters.forEach(item => {
    const hasMain = !!item.dialogue || (includeEmpty && item.dialogueOpen)
    const extras = (item.extraDialogues || []).filter(e => e.text || (includeEmpty && e.open)).length
    stackCount.set(item.characterId, (hasMain ? 1 : 0) + extras)
  })

  const defaultPos = (item, k, total) => {
    const width = 0.3
    const height = 0.1
    const yTop = item.y - 0.12 - (total - 1 - k) * 0.11
    const direction = item.x < 0.5 ? 1 : -1
    const xCenter = item.x + item.width / 2
    const xShift = direction * 0.05 * (total - 1 - k)
    return {
      x: Math.max(0, Math.min(1 - width, xCenter - width / 2 + xShift)),
      y: Math.max(0, Math.min(1 - height, yTop)),
      width,
      height,
    }
  }

  const byInstance = new Map()
  const firstY = new Map()
  const speakerOrder = new Map()
  const speaksFirst = new Map()

  panelCharacters.forEach((item, charIdx) => {
    const definition = characters.find(c => c.id === item.characterId)
    if (!definition) return
    const occurrence = (occurrences.get(item.characterId) || 0) + 1
    occurrences.set(item.characterId, occurrence)
    const name = `${definition.name} ${occurrence}`
    if (!byInstance.has(name)) {
      byInstance.set(name, [])
      speakerOrder.set(name, speakerOrder.size)
      speaksFirst.set(name, !!item.speaksFirst)
    }
    const total = stackCount.get(item.characterId) || 0
    const push = (dialogue) => {
      byInstance.get(name).push(dialogue)
      if (firstY.get(name) == null) firstY.set(name, dialogue.y)
    }
    let k = 0

    if (item.dialogue || (includeEmpty && item.dialogueOpen)) {
      const base = defaultPos(item, k, total)
      const pos = item.dialoguePos ? { ...base, ...item.dialoguePos } : base
      push({ characterId: item.characterId, charIdx, name, text: item.dialogue, type: typeName(item.dialogueType), balloonId: item.balloonId || null, linked: item.linked !== false, align: item.align || DEFAULT_ALIGN, fontSize: item.fontSize, textX: item.textX, textY: item.textY, isExtra: false, extraIdx: null, order: 0, imageRef: item.imageRef || null, ...pos })
      k++
    }
    ;(item.extraDialogues || []).forEach((extra, eIdx) => {
      if (!extra.text && !(includeEmpty && extra.open) && !extra.imageRef) return
      const base = defaultPos(item, k, total)
      const pos = extra.pos ? { ...base, ...extra.pos } : base
      push({ characterId: item.characterId, charIdx, name, text: extra.text, type: typeName(extra.type), balloonId: extra.balloonId || null, linked: extra.linked !== false, align: extra.align || DEFAULT_ALIGN, fontSize: extra.fontSize, textX: extra.textX, textY: extra.textY, isExtra: true, extraIdx: eIdx, order: eIdx + 1, imageRef: extra.imageRef || null, ...pos })
      k++
    })
  })

  const speakers = [...byInstance.keys()].sort((a, b) => {
    const sf = (speaksFirst.get(b) ? 1 : 0) - (speaksFirst.get(a) ? 1 : 0)
    if (sf !== 0) return sf
    const byY = (firstY.get(a) ?? 0) - (firstY.get(b) ?? 0)
    if (byY !== 0) return byY
    return speakerOrder.get(a) - speakerOrder.get(b)
  })

  const ordered = []
  const maxLen = Math.max(...speakers.map(s => byInstance.get(s).length), 0)
  for (let i = 0; i < maxLen; i++) {
    speakers.forEach(s => {
      if (byInstance.get(s)[i]) ordered.push(byInstance.get(s)[i])
    })
  }

  const numbered = ordered.map((d, idx) => ({ ...d, number: idx + 1 }))

  const seen = new Map()
  return numbered.map(d => {
    const sub = (seen.get(d.name) || 0) + 1
    seen.set(d.name, sub)
    const total = byInstance.get(d.name).length
    const label = total > 1 ? `${d.name} ·${sub}` : d.name
    return { ...d, subIndex: sub, instanceTotal: total, label }
  })
}

export function layoutFileNameFor(strip, panelIndex) {
  const base = (strip?.id || 'strip').slice(0, 8)
  return `${base}-layout-${panelIndex + 1}.jpg`
}

export function sceneLayoutFileNameFor(strip, panelIndex) {
  const base = (strip?.id || 'strip').slice(0, 8)
  return `${base}-scene-${panelIndex + 1}.jpg`
}

export function letteringLayoutFileNameFor(strip, panelIndex) {
  const base = (strip?.id || 'strip').slice(0, 8)
  return `${base}-dialogos-${panelIndex + 1}.jpg`
}

export function usedBalloonTypes(panel) {
  const types = new Set()
  if (panel?.narration?.text) types.add('narration')
  ;(panel?.characters || []).forEach(char => {
    const check = (text, type) => {
      if (!text) return
      const t = type || 'speech'
      if (t === 'thought') types.add('thought')
      else if (t === 'speech' || t === 'shout' || t === 'whisper') types.add('speech')
    }
    check(char.dialogue, char.dialogueType)
    ;(char.extraDialogues || []).forEach(extra => check(extra.text, extra.type))
  })
  ;(panel?.globosX || []).forEach(g => {
    if (g.text || g.balloonId) types.add('other')
  })
  return types
}

export function usedBalloonEntityIds(panel, project = null, balloonDefs = []) {
  const ids = new Set()
  const needsDefault = new Set()
  ;(panel?.characters || []).forEach(c => {
    const hasMain = !!c.dialogue
    if (hasMain && c.balloonId) ids.add(c.balloonId)
    else if (hasMain) needsDefault.add(c.dialogueType === 'thought' ? 'thought' : 'speech')
    ;(c.extraDialogues || []).forEach(e => {
      if (e.balloonId) ids.add(e.balloonId)
      else if (e.text) needsDefault.add(e.type === 'thought' ? 'thought' : 'speech')
    })
  })
  if (panel?.narration?.balloonId) ids.add(panel.narration.balloonId)
  else if (panel?.narration?.text) needsDefault.add('narration')
  ;(panel?.globosX || []).forEach(g => {
    if (g.balloonId) ids.add(g.balloonId)
    else if (g.text) needsDefault.add('other')
  })
  needsDefault.forEach(kind => {
    const def = resolveDefaultBalloon(project, balloonDefs, kind)
    if (def) ids.add(def.id)
  })
  return [...ids]
}

function resolveDefaultBalloon(project, balloonDefs = [], kind = null) {
  const pid = project?.id
  const scoped = (balloonDefs || []).filter(b => b.projectId === pid)
  if (kind) {
    const byKind = scoped.filter(b => b.kind === kind)
    if (byKind.length) {
      const marked = byKind.find(b => b.isDefault)
      return marked || byKind[0]
    }
  }
  return scoped.find(b => b.comodin && b.kind === 'other') || null
}

const BALLOON_LETTERING_RULES = [
  'Typography MUST be hand-lettered, drawn with a brush pen: irregular, slightly wobbly, with varying stroke weight. NEVER a computer, digital, or sans-serif typeface.',
  'If a tail is present it must be wavy and trembling, with undulating edges (Crumb style) — never a straight line or a simple smooth curve.',
]

function entityDescPieces(entity) {
  if (entity?.kind === 'image') {
    const pieces = []
    pieces.push('IMAGE BALLOON (an image/picture balloon, NOT a text balloon)')
    if (entity.promptText?.trim()) pieces.push(`Balloon frame/outline: ${cleanPromptText(entity.promptText)}`)
    if (entity.imageStyle?.trim()) pieces.push(`Image style: ${entity.imageStyle.trim()}`)
    const pal = (entity.imagePalette || []).filter(c => c.hex)
    if (pal.length) {
      const mode = entity.imageColorMode || 'full'
      const modeLabel = mode === 'bw' ? 'BLACK & WHITE' : mode === 'duotone' ? 'DUOTONE' : mode === 'limited' ? 'LIMITED COLOR' : 'COLOR'
      pieces.push(`${modeLabel} image palette: ${pal.map(c => c.hex).join(', ')}`)
    }
    if (entity.referenceImages?.length) pieces.push(`use the attached reference image "${entity.referenceImages[0].fileName}" as the balloon graphic (frame)`)
    return pieces
  }
  const pieces = []
  if (entity.promptText?.trim()) pieces.push(entity.promptText.trim().replace(/[.\s]+$/, ''))
  if (entity.text?.trim()) pieces.push(`Default text: "${entity.text.trim()}" (used only when the panel text is empty)`)
  if (entity.referenceImages?.length) pieces.push(`use the attached reference image "${entity.referenceImages[0].fileName}" exactly as the balloon graphic`)
  return pieces
}

function balloonGraphicsText(panel, project, balloonDefs = []) {
  const used = [...usedBalloonTypes(panel)]
  if (!used.length) return ''

  const defaultLaws = makeDefaultBalloonLaws()
  const byId = Object.fromEntries((balloonDefs || []).map(b => [b.id, b]))
  const usedEntities = []
  const lines = ['BALLOON GRAPHICS:']

  const addEntry = (label, entity) => {
    if (entity) usedEntities.push(entity)
    const pieces = entity ? entityDescPieces(entity) : []
    let text = pieces.join('. ')
    if (text && !/[.!?…]$/.test(text)) text += '.'
    lines.push(`- ${label}: ${text || '(default comic balloon style)'}`)
  }

  const fallback = (label, kind = null) => {
    const def = resolveDefaultBalloon(project, balloonDefs, kind)
    if (def) addEntry(`${label.toUpperCase()} ("${def.name}")`, def)
    else addEntry(label.toUpperCase(), null)
  }

  used.forEach(type => {
    const label = BALLOON_LABELS[type] || type
    if (type === 'other') {
      const ids = [...new Set((panel.globosX || []).map(g => g.balloonId).filter(Boolean))]
      const entities = ids.map(id => byId[id]).filter(Boolean)
      if (entities.length) entities.forEach(e => addEntry(`${label.toUpperCase()} ("${e.name}")`, e))
      else fallback(label, 'other')
      return
    }
    const kind = type
    const ids = new Set()
    let needsDefault = false
    ;(panel.characters || []).forEach(c => {
      const check = (balloonId, dType) => {
        const mapped = (dType || 'speech') === 'thought' ? 'thought' : 'speech'
        if (mapped !== kind) return
        if (balloonId) ids.add(balloonId)
        else needsDefault = true
      }
      check(c.balloonId, c.dialogueType)
      ;(c.extraDialogues || []).forEach(e => check(e.balloonId, e.type))
    })
    if (kind === 'narration') {
      if (panel.narration?.balloonId) ids.add(panel.narration.balloonId)
      else if (panel.narration?.text) needsDefault = true
    }
    const entities = [...ids].map(id => byId[id]).filter(Boolean)
    if (entities.length) entities.forEach(e => addEntry(`${label.toUpperCase()} ("${e.name}")`, e))
    else if (needsDefault) fallback(label, kind)
    else addEntry(label.toUpperCase(), null)
  })

  lines.push('')
  const hasImage = usedEntities.some(e => e.kind === 'image')
  const excludeGroups = hasImage ? ['tipografia'] : []

  lines.push('RULES:')
  lines.push(`- BASE (apply to every balloon): ${BALLOON_LETTERING_RULES.join(' ')}`)
  lines.push(`- DEFAULT STYLE (apply to every balloon unless an override below states otherwise): ${balloonLawsToPrompt(defaultLaws, { excludeGroups }).join(' ')}`)
  if (hasImage) lines.push('- IMAGE BALLOONS: they contain a drawn image/picture, NEVER text. All typography rules are void for image balloons. Their inner image is described in the DIALOGUE SEQUENCE below.')
  const seen = new Set()
  usedEntities.forEach(e => {
    if (seen.has(e.id)) return
    seen.add(e.id)
    if (e.kind === 'image') return
    if (lawsEqual(e.laws, defaultLaws)) return
    const diff = balloonLawDiffSentences(e.laws, { excludeGroups })
    if (!diff.additions.length && !diff.exemptions.length) return
    lines.push(`- OVERRIDE "${e.name}": ${[...diff.additions, ...diff.exemptions].join(' ')}`)
  })
  return lines.join('\n')
}

function computeContext(panel, characters = [], backgrounds = [], objects = [], stripAspectRatio = null, project = null) {
  const chars = Array.isArray(characters) ? characters : []
  const bgs = Array.isArray(backgrounds) ? backgrounds : []
  const objs = Array.isArray(objects) ? objects : []
  const panelCharacters = panel.characters || []
  const panelObjects = panel.objects || []
  const panelCharIds = new Set(panelCharacters.map(c => c.characterId))
  const panelObjIds = new Set(panelObjects.map(o => o.objectId))
  const panelConnections = (panel.connections || []).filter(connection => {
    const toType = connection.toType || 'character'
    if (toType === 'object') return panelObjIds.has(connection.to)
    if (toType === 'background') return panel.backgroundId === connection.to
    return panelCharIds.has(connection.to) && panelCharIds.has(connection.from)
  })
  const resolvedAspect = resolveAspectRatio(stripAspectRatio, project)
  const ar = ASPECT_RATIOS.find(item => item.id === resolvedAspect)
  const ratioLabel = ar ? ar.ratio : 'defined'
  return { chars, bgs, objs, panelCharacters, panelObjects, panelConnections, resolvedAspect, ratioLabel }
}

function chatTitleLines(strip) {
  const title = (strip?.title || '').trim()
  if (!title) return []
  return [
    `CHAT TITLE: Name this conversation "${title}" — it is the title of the comic strip set by its author. Rename this chat now, and keep that name for every message in this chat.`,
    '',
  ]
}

function shapeFromRatio(ratio) {
  const parts = String(ratio || '').split(':').map(Number)
  if (parts.length !== 2 || !parts[0] || !parts[1]) return 'rectangle'
  const w = parts[0] / parts[1]
  if (Math.abs(w - 1) < 0.08) return 'square'
  if (w > 1) return 'widescreen rectangle'
  return 'tall vertical rectangle'
}

function headerLines(ctx, layoutFileName, strip = null) {
  const shape = shapeFromRatio(ctx.ratioLabel)
  return [
    `IMAGE FORMAT: ${ctx.ratioLabel}. The final canvas must have exactly a ${ctx.ratioLabel} width:height ratio. Do not generate any other ratio, and do not crop, distort, or rotate. Design the entire composition within this ${shape}.`,
    `POSITIONAL LAYOUT: The file "${layoutFileName}" is a layout reference image showing exact element sizes, positions, and spatial relationships. Use it as a precise compositional guide.`,
    '',
    ...chatTitleLines(strip),
  ]
}

function stylePaletteLines(project, generalStyle, paletteColors) {
  const lines = []
  const projectStyle = projectStyleText(project)
  const styleText = combineStyleText(projectStyle, generalStyle)
  if (styleText) {
    lines.push(`GLOBAL STYLE: ${styleText}`)
    lines.push('')
  }
  const palette = paletteText(project, paletteColors)
  if (palette) {
    lines.push(palette)
    lines.push('')
  }
  lines.push('ATTACHED REFERENCES: for any element with an attached reference image, preserve its identity, form, materials, and distinctive features exactly, in the same line-art style as the rest of the panel.')
  lines.push('')
  return lines
}

function sceneBodyLines(ctx, panel, styleText = '', paletteColors = [], author = null, layoutName = '') {
  const lines = []
  if (panel.timeTransition) {
    const transition = TIME_TRANSITIONS.find(item => item.id === panel.timeTransition)
    if (transition) lines.push(`TIME TRANSITION: ${transition.label}.`)
  }
  if (panel.scene) lines.push(`SCENE: ${panel.scene}`)
  if (panel.horizon) {
    const h = panel.horizon
    const x1 = Math.round((h.x1 ?? 0) * 100)
    const y1 = Math.round((h.y1 ?? h.y ?? 0.5) * 100)
    const x2 = Math.round((h.x2 ?? 1) * 100)
    const y2 = Math.round((h.y2 ?? h.y ?? 0.5) * 100)
    const full = x1 <= 0 && x2 >= 100 && y1 === y2
    const ref = layoutName ? ` It is marked in the layout reference image "${layoutName}" by a line behind all elements — place the horizon exactly there.` : ''
    const style = styleText ? ` Draw it following the project's general style ("${styleText}") — hand-rendered like the rest of the scene, NOT as a perfectly straight ruler line.` : ''
    const span = full
      ? `a full-width line at ${y1}% of the panel height`
      : `a line that starts at ${x1}% from the left edge at ${y1}% height and ends at ${x2}% from the left edge at ${y2}% height`
    lines.push(`HORIZON LINE: ${span}, drawn as a line always behind the landscape, characters, and objects.${h.description ? ` Description: ${h.description}.` : ''}${ref}${style} Draw it behind landscape, characters, and objects.`)
  }

  if (panel.shotType) {
    const shot = SHOT_TYPES.find(item => item.id === panel.shotType && item.scope === 'scene')
    if (shot) lines.push(`CAMERA AND FRAMING (scene composition): ${shot.name}. ${shot.desc}.`)
  }
  if (panel.hatch && panel.hatch !== 'none') {
    const hatch = HATCH_TYPES.find(item => item.id === panel.hatch)
    if (hatch) lines.push(`GRAPHIC TREATMENT: ${hatch.name}; ${hatch.desc}.`)
  }

  lines.push('')
  lines.push('LAYERS AND DEPTH (back to front): landscape, then objects, then characters.')
  if (panel.backgroundId) {
    const backgroundDef = ctx.bgs.find(item => item.id === panel.backgroundId)
    if (backgroundDef) {
      const background = panel.background || { x: 0, y: 0, width: 1, height: 0.5 }
      const placement = describeLandscapePlacement(background)
      const prompt = backgroundDef.comodin
        ? `ONE-OFF BACKGROUND — ${panel.comodinDesc?.trim() ? panel.comodinDesc : '(sin describir)'}. Drawn in the project's global style: "${styleText}".`
        : `${cleanPromptText(backgroundDef.promptText)}.${referenceText(backgroundDef)}`
      lines.push(`- LANDSCAPE, SPATIAL LAYER: "${backgroundDef.name}". ${prompt} ${placement}`)
    }
  } else {
    lines.push('- No landscape defined: do not invent a dominant background.')
  }

  const panelObjects = panel.objects || []
  if (panelObjects.length > 0) {
    lines.push('')
    lines.push('OBJECTS IN SCENE:')
    panelObjects.forEach(item => {
      const definition = ctx.objs.find(object => object.id === item.objectId)
      if (!definition) return
      const { size } = describePosition(item.x, item.y, item.width, item.height)
      const framePos = framePlacementText(item)
      const prompt = definition.comodin
        ? `ONE-OFF OBJECT — ${item.comodinDesc?.trim() ? item.comodinDesc : '(sin describir)'}. Drawn in the project's global style: "${styleText}".`
        : `${cleanPromptText(definition.promptText)}.${referenceText(definition)}${item.note ? ` Note: ${item.note}.` : ''}`
      lines.push(`- "${definition.name}": ${prompt} Coordinates: ${coordinates(item)}. Relative size: ${size}.${framePos ? ` ${framePos}` : ''}`)
    })
  }

  lines.push('')
  lines.push('CHARACTERS AND ACTIONS:')
  const characterOccurrences = new Map()
  ctx.panelCharacters.forEach(item => {
    const definition = ctx.chars.find(character => character.id === item.characterId)
    if (!definition) return
    const occurrence = (characterOccurrences.get(item.characterId) || 0) + 1
    characterOccurrences.set(item.characterId, occurrence)
    const instanceName = `${definition.name} ${occurrence}`
    const { size } = describePosition(item.x, item.y, item.width, item.height)
    const framePos = framePlacementText(item)
    const prompt = definition.comodin
      ? `ONE-OFF CHARACTER — ${item.comodinDesc?.trim() ? item.comodinDesc : '(sin describir)'}. Drawn in the project's global style: "${styleText}".`
      : `${cleanPromptText(definition.promptText)}.${referenceText(definition)}`
    lines.push(`- CHARACTER "${instanceName}": ${prompt} Coordinates: ${coordinates(item)}. Relative size: ${size}.${framePos ? ` ${framePos}` : ''}`)
    if (item.expression) lines.push(`  Expression: ${item.expression}.`)
    if (item.framing) {
      const shot = SHOT_TYPES.find(s => s.id === item.framing)
      if (shot) lines.push(`  Framing: ${shot.name} — ${shot.desc}.`)
    }
    if (item.actions?.length > 0) {
      lines.push(`  Action: ${item.actions.join(', ')}.`)
      item.actions.forEach(action => {
        const effect = ACTION_EFFECTS[action]
        const description = effect?.motionLines && MOTION_LINE_DESCS[effect.motionLines]
        if (description) lines.push(`  Visual effect: ${description}.`)
      })
    }
    if (item.actionNotes) {
      lines.push(`  Action description: ${item.actionNotes}.`)
    }

    const hasGazeArrow = ctx.panelConnections.some(c => c.from === item.characterId)
    const direction = DIRECTIONS.find(value => value.id === item.direction)
    if (direction) {
      const mode = item.directionMode || 'body'
      const wantsBody = mode === 'body' || mode === 'body-gaze'
      const wantsFace = mode === 'face-gaze'
      const wantsGaze = DIRECTION_MODE_HAS_GAZE.has(mode) && !hasGazeArrow
      if (wantsBody) lines.push(`  Body orientation: ${direction.name}.`)
      if (wantsFace) lines.push(`  Face orientation: ${direction.name}.`)
      if (wantsGaze) lines.push(`  Gaze direction: ${direction.name}.`)
    }
  })

  if (ctx.panelConnections.length > 0) {
    lines.push('')
    lines.push('VISUAL RELATIONSHIPS:')
    ctx.panelConnections.forEach(connection => {
      const source = ctx.chars.find(item => item.id === connection.from)
      const target = connectionTargetName(connection, ctx.chars, ctx.objs, ctx.bgs)
      if (source && target) lines.push(`- ${source.name} looks at ${target}. Gaze and visual attention must be directed toward that target.`)
    })
  }

  if (panel.signature) {
    lines.push('')
    lines.push(...signaturePromptLines(panel.signature, author, paletteColors))
  }

  return lines
}

function signaturePromptLines(signature, author, paletteColors = []) {
  const color = (paletteColors || []).find(c => c.id === signature.colorId)
  const colorDesc = color
    ? `${color.hex}${color.label ? ` ("${color.label}")` : ''}`
    : 'the project default ink (as the rest of the line art)'
  const image = author?.signatureImage?.[0]
  const textSig = author?.signatureText?.trim() || author?.fullName?.trim() || ''
  let graphic
  if (image) {
    graphic = `Use the attached signature reference image "${image.fileName}" exactly as the signature, scaled to fit the area.`
  } else if (textSig) {
    graphic = `Draw the signature as handwritten text: "${textSig}", in a loose personal handwriting style consistent with the rest of the panel.`
  } else {
    graphic = 'No signature graphic available: leave this area empty.'
  }
  return [
    'SIGNATURE: Place the author\'s signature in the area at ' +
      `x ${Math.round(signature.x * 100)}%, y ${Math.round(signature.y * 100)}%, w ${Math.round(signature.width * 100)}%, h ${Math.round(signature.height * 100)}%.`,
    `- Color: ${colorDesc}.`,
    `- Graphic: ${graphic}`,
  ]
}

function globoXAnchorText(gx, ctx) {
  const a = gx.anchor || {}
  switch (a.type) {
    case 'character': {
      const pc = (ctx.panelCharacters || []).find(c => c.characterId === a.id)
      const def = pc && ctx.chars.find(c => c.id === pc.characterId)
      return `tail pointing to the head of character "${def?.name || '?'}"`
    }
    case 'object': {
      const po = (ctx.panelObjects || []).find(o => o.objectId === a.id)
      const def = po && ctx.objs.find(o => o.id === po.objectId)
      return `tail pointing to the object "${def?.name || '?'}"`
    }
    case 'narration':
      return 'tail pointing to the narration box'
    case 'offpanel':
      return `originating from OUTSIDE the panel at the ${a.direction || 'bottom'} edge (its tail exits the frame)`
    default:
      return 'no tail (free-floating caption)'
  }
}

function imageBalloonContent(entity, text, project, generalStyle, paletteColors, imageRef = null) {
  const sceneText = (text?.trim() || '').trim()
  let content = sceneText
    ? `inside the balloon, draw this scene: "${sceneText}". `
    : `inside the balloon, draw the scene the author described for this balloon in the panel editor. `
  if (imageRef?.fileName) {
    content += ` CRITICAL: Reference image "${imageRef.fileName}" is provided and MUST be rendered STRICTLY AND EXCLUSIVELY INSIDE this balloon — it goes DENTRO del globo referido, filling its interior exactly. Do NOT use it as background, scene, or separate element outside the balloon; it belongs ONLY inside this balloon. The text description (if any) and this image must be combined: the image is the primary visual source for what appears inside, guided by the text. Preserve its content faithfully inside the balloon shape.`
  }
  content += ` The scene MUST be drawn STRICTLY INSIDE the balloon, filling its interior; nothing may break out of the balloon outline. Do NOT place any text, letters, or typography inside or around this balloon.`
  const imgStyle = entity.imageStyle?.trim() || combineStyleText(projectStyleText(project), generalStyle) || ''
  if (imgStyle) content += ` Image style: ${imgStyle}.`
  const imgPal = (entity.imagePalette || []).filter(c => c.hex)
  if (imgPal.length) {
    const mode = entity.imageColorMode || 'full'
    const modeLabel = mode === 'bw' ? 'BLACK & WHITE' : mode === 'duotone' ? 'DUOTONE' : mode === 'limited' ? 'LIMITED COLOR' : 'COLOR'
    content += ` ${modeLabel} image palette: ${imgPal.map(c => c.hex).join(', ')}.`
  } else {
    const projPal = paletteText(project, paletteColors)
    if (projPal) content += ` ${projPal}`
  }
  if (imageRef?.fileName) {
    content += ` ATTACHED IMAGE FOR THIS BALLOON ONLY: "${imageRef.fileName}" — must be used as the interior image, strictly inside this balloon, not elsewhere. It is already attached to the request; render it inside.`
  }
  return `contains an IMAGE, not text: ${content}`
}

function letteringLines(ctx, panel, project, layoutFileName, balloonDefs = [], generalStyle = '', paletteColors = null) {
  const lines = []
  const balloons = balloonGraphicsText(panel, project, balloonDefs)
  if (balloons) {
    lines.push(balloons)
    lines.push('')
  }

  const panelSfx = panel.sfx || []
  const hasNarration = panel.narration && panel.narration.text
  if (hasNarration || panelSfx.some(item => item.text)) {
    lines.push('')
    lines.push('TEXT AND GRAPHIC ELEMENTS:')
    if (hasNarration) {
      const narr = panel.narration
      const { size } = describePosition(narr.x, narr.y, narr.width, narr.height)
      const style = narr.framed ? 'FRAMED' : 'FREEFORM'
      let narrStyle = ''
      if (narr.balloonId) {
        const override = (balloonDefs || []).find(b => b.id === narr.balloonId)
        if (override) narrStyle = ` Balloon style entity: "${override.name}".`
      }
      const narrParts = markdownPromptParts(narr.text, narr.align)
      const narrExtras = []
      if (narrParts.emphasis.length) narrExtras.push(` Lettering emphasis: ${narrParts.emphasis.join('; ')}.`)
      narrExtras.push(...narrParts.lineBreaks)
      narrExtras.push(` ${narrParts.align}`)
      narrExtras.push(layoutPrompt(narr.fontSize, narr.textX, narr.textY))
      lines.push(`- Narration [${style}]: "${narrParts.literal}". Coordinates: ${coordinates(narr)}. Relative size: ${size}.${narr.framed ? ' Text inside a visible border box.' : ' Floating text without border.'}${narrExtras.join('')}${narrStyle}`)
    }
    panelSfx.forEach(item => {
      if (!item.text) return
      const { size } = describePosition(item.x, item.y, item.width, item.height)
      lines.push(`- Sound effect "${item.text}": coordinates ${coordinates(item)}, size ${size}, style ${item.style}.`)
    })
  }

  if (hasNarration) {
    const characterOccurrences = new Map()
    ctx.panelCharacters.forEach(item => {
      const occurrence = (characterOccurrences.get(item.characterId) || 0) + 1
      characterOccurrences.set(item.characterId, occurrence)
    })
    ctx.panelCharacters.forEach(item => {
      if (item.gazeTarget?.type === 'narration') {
        const definition = ctx.chars.find(character => character.id === item.characterId)
        if (definition) {
          const occurrence = characterOccurrences.get(item.characterId) || 1
          lines.push(`  GAZE: ${definition.name} ${occurrence} looks at the narration box.`)
        }
      }
    })
  }

  const orderedDialogues = orderedPanelDialogues(panel, ctx.chars)
  if (orderedDialogues.length > 0) {
    lines.push('')
    lines.push('DIALOGUE SEQUENCE — STRICT, MUST BE REPRODUCED EXACTLY (verbatim, in this logical order):')
    lines.push(`PHYSICAL PLACEMENT: follow "${layoutFileName}" for each balloon's exact position, size, and order on canvas (highest priority). The sequence below is the logical reading order only.`)
    const handDrawnConnector = `Connect them with a short, thin connector tube drawn by hand with the same bold outline as the balloons. The tube enters BOTH balloons: each balloon's outline must be left OPEN where the tube meets it (the outline line is interrupted there so the tube passes through and links the two interiors — never drawn over a closed outline). Only the LAST balloon of the chain carries the solid tail pointing to the speaker. Keep a clear visible gap between these balloons and any balloon outside this chain (whether from another speaker or a DISCONNECTED balloon of the same speaker).`
    // Agrupar los globos de cada hablante en cadenas conectadas: un globo con
    // linked === false no se une al anterior e inicia una cadena nueva (independiente,
    // con su propia cola hacia el hablante).
    const byName = new Map()
    orderedDialogues.forEach(d => {
      const list = byName.get(d.name) || []
      list.push(d)
      byName.set(d.name, list)
    })
    const groupInfo = new Map()
    byName.forEach(list => {
      let start = 0
      for (let i = 0; i < list.length; i++) {
        const isEnd = i === list.length - 1 || list[i + 1].linked === false
        if (!isEnd) continue
        for (let j = start; j <= i; j++) {
          groupInfo.set(list[j], {
            first: j === start,
            last: j === i,
            length: i - start + 1,
          })
        }
        start = i + 1
      }
    })
    const lastByChar = {}
    let anyImage = false
    orderedDialogues.forEach((d, idx) => {
      const placement = dialoguePlacementText(d)
      const entity = d.balloonId ? (balloonDefs || []).find(b => b.id === d.balloonId) : null
      const isImage = entity?.kind === 'image'
      if (isImage) anyImage = true
      const typeLabel = isImage ? 'image balloon' : (DIALOGUE_TYPE_LABELS[d.type] || d.type)
      const prev = lastByChar[d.name]
      const gi = groupInfo.get(d)
      const chainMember = gi.length > 1
      const isChainLast = gi.last && chainMember
      const isStandalone = gi.length === 1
      const linkage = (() => {
        if (prev == null) {
          return chainMember
            ? ` Balloon ${d.number} is the FIRST of a chain belonging to ${d.name}: it is joined to the NEXT balloon by a short connector tube and has NO tail of its own — only the last balloon of the chain carries the tail pointing to the speaker.`
            : ''
        }
        if (isStandalone) {
          return ` Balloon ${d.number} belongs to the same speaker as balloon ${prev} (${d.name}) but is DISCONNECTED from it: do NOT join them with a connector tube. Place it as a separate, independent balloon with its own tail pointing to the speaker.`
        }
        if (isChainLast) {
          return ` Balloon ${d.number} belongs to the same speaker as balloon ${prev} (${d.name}). They MUST be placed in SEPARATE, non-overlapping positions of the panel as shown in the layout image — do NOT stack, merge, or attach them. ${handDrawnConnector}`
        }
        return ` Balloon ${d.number} belongs to the same speaker as balloon ${prev} (${d.name}): it is joined to it by a short connector tube and continues the same chain (only the last balloon of the chain carries the tail pointing to the speaker).`
      })()
      lastByChar[d.name] = d.number
      let styleRef = ''
      if (entity) styleRef = ` Balloon style entity: "${entity.name}".`
      const content = isImage
        ? imageBalloonContent(entity, d.text, project, generalStyle, paletteColors, d.imageRef || null)
        : (() => {
            const parts = markdownPromptParts(d.text, d.align)
            const extras = []
            if (parts.emphasis.length) extras.push(` Lettering emphasis: ${parts.emphasis.join('; ')}.`)
            extras.push(...parts.lineBreaks)
            extras.push(` ${parts.align}`)
            extras.push(layoutPrompt(d.fontSize, d.textX, d.textY))
            return `contains exactly: "${parts.literal}".${extras.join('')}`
          })()
      const anchor = (isImage || d.type === 'thought')
        ? (() => {
            const ch = (ctx.panelCharacters || [])[d.charIdx]
            const side = bubbleSideFromHead(d, ch) || 'UPPER'
            return ` It is joined to the head of the speaker (${d.name}) by a trail of THREE small bubbles decreasing in size. The bubbles must emerge from the ${side} side of the character's head and point from the balloon down toward their head, following the bubble trail in the layout. They must always stay visibly connected to the head — NEVER hanging loose or disconnected.`
          })()
        : (chainMember && !isChainLast
          ? ` It has NO tail of its own: it is joined to the next balloon by the connector tube; only the last balloon of the chain carries the tail pointing to the speaker (${d.name}).`
          : ` Its tail must point to the head of the speaker (${d.name}).`)
      const tabId = d.linked === false ? `${d.number} suelto` : `${d.number}`
      if (idx === 0) {
        lines.push(`${d.number}. Balloon ${tabId} ("${d.label}") speaks FIRST: it is placed ${placement} and ${content} Balloon type: ${typeLabel}.${isImage ? '' : channelStyleText(d.type)}${styleRef}${anchor}`)
      } else {
        lines.push(`${d.number}. Balloon ${tabId} ("${d.label}") responds: it is placed ${placement} and ${content} Balloon type: ${typeLabel}.${isImage ? '' : channelStyleText(d.type)}${linkage}${styleRef}${anchor}`)
      }
    })

    lines.push(`BALLOON STYLE AND LETTERING: strictly follow the balloon style defined in BALLOON GRAPHICS above; do not alter the wording, the lettering, or the balloon shape.${anyImage ? ' IMAGE balloons contain a drawn image and NO text: their lettering and typography rules are void.' : ''}`)
  }

  const globosX = (panel.globosX || []).filter(g => g.text || ((balloonDefs || []).find(b => b.id === g.balloonId)?.kind === 'image'))
  if (globosX.length > 0) {
    lines.push('')
    lines.push('CAPTIONS AND FREE BALLOONS (GLOBO X) — SEPARATE from the dialogue sequence; place each one exactly as shown in the layout image:')
    globosX.forEach((g, i) => {
      const placement = dialoguePlacementText(g)
      const entity = g.balloonId ? (balloonDefs || []).find(b => b.id === g.balloonId) : null
      const isImage = entity?.kind === 'image'
      const channel = isImage ? 'image' : (DIALOGUE_TYPE_LABELS[g.channel] || g.channel || 'speech')
      const anchor = globoXAnchorText(g, ctx)
      const styleRef = entity ? ` Balloon style entity: "${entity.name}".` : ''
      const content = isImage
        ? imageBalloonContent(entity, g.text, project, generalStyle, paletteColors, g.imageRef || null)
        : (() => {
            const parts = markdownPromptParts(g.text, g.align)
            const extras = []
            if (parts.emphasis.length) extras.push(` Lettering emphasis: ${parts.emphasis.join('; ')}.`)
            extras.push(...parts.lineBreaks)
            extras.push(` ${parts.align}`)
            extras.push(layoutPrompt(g.fontSize, g.textX, g.textY))
            return `contains exactly: "${parts.literal}".${extras.join('')}`
          })()
      const bubbleTrail = (isImage || channel === 'thought')
        ? (() => {
            const a = g.anchor || {}
            const ch = a.type === 'character'
              ? (ctx.panelCharacters || []).find(c => c.characterId === a.id)
              : null
            const side = bubbleSideFromHead(g, ch)
            return side
              ? ` Connect it to the head by a trail of THREE small bubbles decreasing in size. The bubbles must emerge from the ${side} side of the character's head and stay visibly connected to it — NEVER hanging loose or disconnected.`
              : ` Connect it to its anchor by a trail of THREE small bubbles decreasing in size, pointing directly at the anchor, always visibly connected — NEVER hanging loose or disconnected.`
          })()
        : ''
      lines.push(`${i + 1}. Balloon "X${i + 1}" is placed ${placement} and ${content} Channel: ${channel}.${isImage ? '' : channelStyleText(g.channel)} Its ${anchor}.${bubbleTrail}${styleRef}`)
    })
  }

  return lines
}

function panelUsesImageBalloon(panel, balloonDefs = []) {
  const ids = new Set()
  ;(panel?.characters || []).forEach(c => {
    if (c.balloonId) ids.add(c.balloonId)
    ;(c.extraDialogues || []).forEach(e => { if (e.balloonId) ids.add(e.balloonId) })
  })
  ;(panel?.globosX || []).forEach(g => { if (g.balloonId) ids.add(g.balloonId) })
  return (balloonDefs || []).some(b => ids.has(b.id) && b.kind === 'image')
}

function panelHasBubbleAnchored(panel, balloonDefs = []) {
  const defs = balloonDefs || []
  for (const c of (panel?.characters || [])) {
    if (c.dialogueType === 'thought') return true
    if ((c.extraDialogues || []).some(e => e.type === 'thought')) return true
    const ids = [c.balloonId, ...(c.extraDialogues || []).map(e => e.balloonId)]
    if (defs.some(b => ids.includes(b.id) && b.kind === 'image')) return true
  }
  for (const g of (panel?.globosX || [])) {
    if (g.channel === 'thought') return true
    if (defs.some(b => b.id === g.balloonId && b.kind === 'image')) return true
  }
  return false
}

function letteringFinalCheck(hasImageBalloon, hasBubbleAnchor = false) {
  const bubbleCheck = hasBubbleAnchor
    ? ' Also verify that every thought and image balloon is visibly connected to its speaker\'s head by its three bubbles — NEVER left hanging or disconnected.'
    : ''
  if (hasImageBalloon) {
    return 'FINAL CHECK: Before finishing, verify every balloon is crafted to respect the specified style — subtle and restrained, not exaggerated. Check that each balloon emerges correctly from its anchor (character head, object, narration box, or panel edge as indicated), and that consecutive balloons of the same speaker are joined by a short, thin connector tube — except any balloon explicitly DISCONNECTED from the previous one, which must remain a separate, independent balloon with its own tail. IMAGE balloons must contain the described scene drawn STRICTLY inside them, with NO text, letters, or typography.' + bubbleCheck
  }
  return 'FINAL CHECK — LEGIBILITY AND BALLOON STYLE: Before finishing, verify that the specified typography and its lettering style are fully legible, and that every balloon is crafted to respect the specified style — subtle and restrained, not exaggerated. Also check that each balloon emerges correctly from its anchor (character head, object, narration box, or panel edge as indicated), and that consecutive balloons of the same speaker are joined by a short, thin connector tube — except any balloon explicitly DISCONNECTED from the previous one, which must remain a separate, independent balloon with its own tail.' + bubbleCheck
}

const LEGAL_NOTICE = 'IMPORTANT: I certify that I am the sole author and rightful owner of all images attached to this request and of the content of the prompt itself, and that I hold the rights to use them. I take full responsibility for any legal issue that may arise from this generation.'

function withLegalNotice(lines) {
  return [...lines, '', LEGAL_NOTICE]
}

export function generateScenePrompt(panel, characters = [], generalStyle, backgrounds = [], objects = [], stripAspectRatio = null, panelIndex = 0, strip = null, project = null, layoutFileName = null, paletteColors = null, author = null) {
  const ctx = computeContext(panel, characters, backgrounds, objects, stripAspectRatio, project)
  const layoutName = layoutFileName || layoutFileNameFor(strip, panelIndex)
  const projectStyle = projectStyleText(project)
  const styleText = combineStyleText(projectStyle, generalStyle)
  const lines = [
    ...headerLines(ctx, layoutName, strip),
    ...stylePaletteLines(project, generalStyle, paletteColors),
    'LETTERING LOCK: This prompt describes the SCENE layer only, WITHOUT any dialogue or lettering. Do NOT draw any speech balloons, thought bubbles, narration boxes, captions, or sound-effect words. Do not write any text, letters, or typography anywhere in the image. Do not leave blank outlines, circles, or box placeholders hinting at future balloons. The scene must stand alone as a text-free panel; lettering is added later in a separate step.',
    '',
    ...sceneBodyLines(ctx, panel, styleText, paletteColors, author, layoutName),
    '',
    `FINAL REMINDER: Generate a single comic panel in ${ctx.ratioLabel} aspect ratio with clear composition, correct layering, and spatial relationships preserved, and with NO text, lettering, or balloons of any kind. Use "${layoutName}" strictly as a spatial guide for where each scene element sits — do NOT copy its figures, lines, or graphic aspects. DO NOT CHANGE THE ASPECT RATIO.`,
  ]
  return withLegalNotice(lines).join('\n')
}

export function generateLetteringPrompt(panel, characters = [], generalStyle, backgrounds = [], objects = [], stripAspectRatio = null, panelIndex = 0, strip = null, project = null, layoutFileName = null, balloons = [], paletteColors = null) {
  const ctx = computeContext(panel, characters, backgrounds, objects, stripAspectRatio, project)
  const layoutName = layoutFileName || layoutFileNameFor(strip, panelIndex)
  const lines = [
    `IMAGE FORMAT: ${ctx.ratioLabel}. The final canvas must have exactly a ${ctx.ratioLabel} width:height ratio. Do not generate any other ratio, and do not crop, distort, or rotate.`,
    `POSITIONAL LAYOUT: The file "${layoutName}" is a layout reference image showing the exact positions, sizes, and order of the lettering elements (balloons, narration, sound effects) on the canvas. Use it as a precise guide.`,
    '',
    ...chatTitleLines(strip),
    'SCENE LOCK: You are given the finished scene image generated in the previous step (attach it as the input image). Keep EVERYTHING in that scene EXACTLY as it is — do NOT redraw, recolor, move, resize, or alter any character, object, background, lighting, expression, line style, or detail. Do NOT change the composition or the aspect ratio. ONLY add the lettering elements described below, placed precisely where indicated.',
    '',
    ...letteringLines(ctx, panel, project, layoutName, balloons, generalStyle, paletteColors),
    '',
    ...(panelUsesImageBalloon(panel, balloons)
      ? []
      : [`FINAL REMINDER — LETTERING ONLY: Keep the scene image unchanged and add ONLY the lettering specified above (balloons, narration, sound effects, captions), at the exact coordinates given and following "${layoutName}" for placement. Do not modify anything else. DO NOT CHANGE THE ASPECT RATIO.`]),
    letteringFinalCheck(panelUsesImageBalloon(panel, balloons)),
  ]
  return withLegalNotice(lines).join('\n')
}

export function generatePureDialoguePrompt(panel, characters = [], generalStyle, backgrounds = [], objects = [], stripAspectRatio = null, panelIndex = 0, strip = null, project = null, layoutFileName = null, balloons = [], paletteColors = null) {
  const ctx = computeContext(panel, characters, backgrounds, objects, stripAspectRatio, project)
  const layoutName = layoutFileName || layoutFileNameFor(strip, panelIndex)
  const lines = [
    `IMAGE FORMAT: ${ctx.ratioLabel}. The final canvas must have exactly a ${ctx.ratioLabel} width:height ratio. Do not generate any other ratio, and do not crop, distort, or rotate. Design the entire composition within this ${shapeFromRatio(ctx.ratioLabel)}.`,
    `POSITIONAL LAYOUT: The file "${layoutName}" is a layout reference image showing the exact positions, sizes, and order of the lettering elements (balloons, narration, sound effects) on the canvas. Use it as a precise guide.`,
    '',
    ...chatTitleLines(strip),
    `PURE DIALOGUE — NO SCENE IMAGE: This panel is dialogue-only and is NOT based on any scene image. No image is attached and none should be invented — do NOT add landscape, objects, characters, or background. Generate a clean panel with a plain white background, exactly ${ctx.ratioLabel}, respecting the tira proportions. Use "${layoutName}" solely as a positional guide for balloons and text. Pay special attention to the fontSize, textX, textY and relative size values in the lettering details — do NOT enlarge lettering or balloons beyond the specified sizes; the absence of other elements does not justify larger text. Keep generous white margins as indicated by the layout.`,
    '',
    ...letteringLines(ctx, panel, project, layoutName, balloons, generalStyle, paletteColors),
    '',
    `FINAL REMINDER — PURE DIALOGUE: Generate a clean white dialogue panel in ${ctx.ratioLabel}, with ONLY the lettering specified above (balloons, narration, sound effects, captions) at the exact coordinates given and following "${layoutName}" for placement. Do NOT add any scene imagery, landscape, characters or objects. DO NOT CHANGE THE ASPECT RATIO. Keep lettering at the indicated sizes — do not enlarge due to empty space.`,
    letteringFinalCheck(panelUsesImageBalloon(panel, balloons), panelHasBubbleAnchored(panel, balloons)),
  ]
  return withLegalNotice(lines).join('\n')
}

export function generatePanelPrompt(panel, characters = [], generalStyle, backgrounds = [], objects = [], stripAspectRatio = null, panelIndex = 0, strip = null, project = null, balloons = [], paletteColors = null, author = null) {
  const ctx = computeContext(panel, characters, backgrounds, objects, stripAspectRatio, project)
  const layoutName = layoutFileNameFor(strip, panelIndex)
  const projectStyle = projectStyleText(project)
  const styleText = combineStyleText(projectStyle, generalStyle)
  const lines = [
    ...headerLines(ctx, layoutName, strip),
    ...stylePaletteLines(project, generalStyle, paletteColors),
    ...sceneBodyLines(ctx, panel, styleText, paletteColors, author, layoutName),
    ...letteringLines(ctx, panel, project, layoutName, balloons, generalStyle, paletteColors),
    '',
    `FINAL REMINDER: Generate a single comic panel in ${ctx.ratioLabel} aspect ratio with clear composition, correct layering, and spatial relationships preserved. Use "${layoutName}" strictly as a spatial guide for where each element (including balloons) sits — do NOT copy its figures, lines, or graphic aspects. DO NOT CHANGE THE ASPECT RATIO.`,
    letteringFinalCheck(panelUsesImageBalloon(panel, balloons), panelHasBubbleAnchored(panel, balloons)),
  ]
  return withLegalNotice(lines).join('\n')
}

export function generateAllPanelsPrompt(strip, characters = [], backgrounds = [], objects = [], project = null, balloons = [], paletteColors = null, author = null) {
  const chars = Array.isArray(characters) ? characters : []
  const bgs = Array.isArray(backgrounds) ? backgrounds : []
  const objs = Array.isArray(objects) ? objects : []
  return (strip?.panels || []).map((panel, index) => {
    const prompt = generatePanelPrompt(panel, chars, strip.generalStyle, bgs, objs, strip.aspectRatio, index, strip, project, balloons, paletteColors, author)
    return `=== PANEL ${index + 1} ===\n\n${prompt}`
  }).join('\n\n')
}
