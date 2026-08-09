import { DIALOGUE_TYPES, DIRECTIONS, SHOT_TYPES, HATCH_TYPES, TIME_TRANSITIONS, MOTION_LINE_DESCS, ACTION_EFFECTS, ASPECT_RATIOS } from '../data/actionPresets'

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

export function projectStyleText(project) {
  if (!project) return ''
  const parts = []
  if (project.genre) parts.push(`Genre/tone: ${project.genre}`)
  if (project.drawingStyle) parts.push(`Drawing style: ${project.drawingStyle}`)
  if (project.world) parts.push(`Setting/world: ${project.world}`)
  if (project.styleNotes) parts.push(project.styleNotes)
  return parts.join('. ')
}

export function paletteText(project) {
  if (!project) return ''
  if (project.colorMode === 'bw') return 'COLOR PALETTE: pure black ink on white paper — black-and-white line art. Draw with solid black strokes and solid black ink accents only. NO gray midtones, NO gray fills, NO flat gray areas, NO shading with gray tones, NO color.'
  const colors = (project.palette || []).filter(c => c.hex)
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

export function orderedPanelDialogues(panel, characters = []) {
  const panelCharacters = panel?.characters || []
  const occurrences = new Map()
  const typeName = (id) => DIALOGUE_TYPES.find(v => v.id === id)?.id || 'speech'

  const stackCount = new Map()
  panelCharacters.forEach(item => {
    const hasMain = !!item.dialogue
    const extras = (item.extraDialogues || []).filter(e => e.text).length
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

  panelCharacters.forEach((item, charIdx) => {
    const definition = characters.find(c => c.id === item.characterId)
    if (!definition) return
    const occurrence = (occurrences.get(item.characterId) || 0) + 1
    occurrences.set(item.characterId, occurrence)
    const name = `${definition.name} ${occurrence}`
    if (!byInstance.has(name)) {
      byInstance.set(name, [])
      speakerOrder.set(name, speakerOrder.size)
    }
    const total = stackCount.get(item.characterId) || 0
    const push = (dialogue) => {
      byInstance.get(name).push(dialogue)
      if (firstY.get(name) == null) firstY.set(name, dialogue.y)
    }
    let k = 0

    if (item.dialogue) {
      const base = defaultPos(item, k, total)
      const pos = item.dialoguePos ? { ...base, ...item.dialoguePos } : base
      push({ characterId: item.characterId, charIdx, name, text: item.dialogue, type: typeName(item.dialogueType), isExtra: false, extraIdx: null, order: 0, ...pos })
      k++
    }
    ;(item.extraDialogues || []).forEach((extra, eIdx) => {
      if (!extra.text) return
      const base = defaultPos(item, k, total)
      const pos = extra.pos ? { ...base, ...extra.pos } : base
      push({ characterId: item.characterId, charIdx, name, text: extra.text, type: typeName(extra.type), isExtra: true, extraIdx: eIdx, order: eIdx + 1, ...pos })
      k++
    })
  })

  const speakers = [...byInstance.keys()].sort((a, b) => {
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
  return types
}

const BALLOON_LETTERING_RULES = [
  'Typography MUST be hand-lettered, drawn with a brush pen: irregular, slightly wobbly, with varying stroke weight. NEVER a computer, digital, or sans-serif typeface.',
  'The balloon outline stroke must be THICK and heavy (visibly bold), not thin.',
  'If a tail is present it must be wavy and trembling, with undulating edges (Crumb style) — never a straight line or a simple smooth curve.',
]

function balloonGraphicsText(project, panel) {
  const balloons = project?.balloons
  if (!balloons) return ''
  const used = [...usedBalloonTypes(panel)].filter(type => balloons[type])
  if (!used.length) return ''

  const parts = used.map(type => {
    const balloon = balloons[type]
    const label = BALLOON_LABELS[type] || type
    const pieces = []
    if (balloon.description?.trim()) pieces.push(balloon.description.trim())
    if (balloon.fileName) pieces.push(`use the attached reference image "${balloon.fileName}" exactly as the balloon graphic`)
    return `${label.toUpperCase()}: ${pieces.join('. ')}`
  })

  const lines = ['BALLOON GRAPHICS:']
  parts.forEach(part => lines.push(`- ${part}`))
  lines.push(`- COMMON RULES (apply to every balloon): ${BALLOON_LETTERING_RULES.join(' ')}`)
  return lines.join('\n')
}

function computeContext(panel, characters = [], backgrounds = [], objects = [], stripAspectRatio = null, project = null) {
  const chars = Array.isArray(characters) ? characters : []
  const bgs = Array.isArray(backgrounds) ? backgrounds : []
  const objs = Array.isArray(objects) ? objects : []
  const panelCharacters = panel.characters || []
  const panelConnections = panel.connections || []
  const connectedCharacters = new Set()
  panelConnections.forEach(connection => {
    const targetName = connectionTargetName(connection, chars, objs, bgs)
    const source = chars.find(item => item.id === connection.from)
    if (source && targetName) {
      connectedCharacters.add(source.id)
      if ((connection.toType || 'character') === 'character') connectedCharacters.add(connection.to)
    }
  })
  const resolvedAspect = resolveAspectRatio(stripAspectRatio, project)
  const ar = ASPECT_RATIOS.find(item => item.id === resolvedAspect)
  const ratioLabel = ar ? ar.ratio : 'defined'
  return { chars, bgs, objs, panelCharacters, panelConnections, connectedCharacters, resolvedAspect, ratioLabel }
}

function headerLines(ctx, layoutFileName) {
  return [
    `IMAGE FORMAT: ${ctx.ratioLabel}. The final canvas must have exactly a ${ctx.ratioLabel} width:height ratio. Do not generate any other ratio, and do not crop, distort, or rotate. Design the entire composition within this rectangle.`,
    `POSITIONAL LAYOUT: The file "${layoutFileName}" is a layout reference image showing exact element sizes, positions, and spatial relationships. Use it as a precise compositional guide.`,
    '',
  ]
}

function stylePaletteLines(project, generalStyle) {
  const lines = []
  const projectStyle = projectStyleText(project)
  const styleText = (projectStyle && generalStyle) ? `${projectStyle}. ${generalStyle}` : (projectStyle || generalStyle || '')
  if (styleText) {
    lines.push(`GLOBAL STYLE: ${styleText}`)
    lines.push('')
  }
  const palette = paletteText(project)
  if (palette) {
    lines.push(palette)
    lines.push('')
  }
  lines.push('ATTACHED REFERENCES: for any element with an attached reference image, preserve its identity, form, materials, and distinctive features exactly, in the same line-art style as the rest of the panel.')
  lines.push('')
  return lines
}

function sceneBodyLines(ctx, panel, styleText = '') {
  const lines = []
  if (panel.timeTransition) {
    const transition = TIME_TRANSITIONS.find(item => item.id === panel.timeTransition)
    if (transition) lines.push(`TIME TRANSITION: ${transition.label}.`)
  }
  if (panel.scene) lines.push(`SCENE: ${panel.scene}`)
  if (panel.horizon) lines.push(`HORIZON LINE: at ${Math.round(panel.horizon.y * 100)}% of the panel height.${panel.horizon.description ? ` Description: ${panel.horizon.description}.` : ''} Draw behind landscape, characters, and objects.`)

  if (panel.shotType) {
    const shot = SHOT_TYPES.find(item => item.id === panel.shotType)
    if (shot) lines.push(`CAMERA AND FRAMING: ${shot.name}. ${shot.desc}.`)
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
        : `${backgroundDef.promptText}.${referenceText(backgroundDef)}`
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
      const prompt = definition.comodin
        ? `ONE-OFF OBJECT — ${item.comodinDesc?.trim() ? item.comodinDesc : '(sin describir)'}. Drawn in the project's global style: "${styleText}".`
        : `${definition.promptText}.${referenceText(definition)}${item.note ? ` Note: ${item.note}.` : ''}`
      lines.push(`- "${definition.name}": ${prompt} Coordinates: ${coordinates(item)}. Relative size: ${size}.`)
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
    const prompt = definition.comodin
      ? `ONE-OFF CHARACTER — ${item.comodinDesc?.trim() ? item.comodinDesc : '(sin describir)'}. Drawn in the project's global style: "${styleText}".`
      : `${definition.promptText}.${referenceText(definition)}`
    lines.push(`- CHARACTER "${instanceName}": ${prompt} Coordinates: ${coordinates(item)}. Relative size: ${size}.`)
    if (item.expression) lines.push(`  Expression: ${item.expression}.`)
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

    if (!ctx.connectedCharacters.has(item.characterId)) {
      const direction = DIRECTIONS.find(value => value.id === item.direction)
      if (direction) lines.push(`  Body orientation: ${direction.name}.`)
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

  return lines
}

function letteringLines(ctx, panel, project, layoutFileName) {
  const lines = []
  const balloons = balloonGraphicsText(project, panel)
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
      lines.push(`- Narration [${style}]: "${narr.text}". Coordinates: ${coordinates(narr)}. Relative size: ${size}.${narr.framed ? ' Text inside a visible border box.' : ' Floating text without border.'}`)
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
    const lastByChar = {}
    orderedDialogues.forEach((d, idx) => {
      const placement = dialoguePlacementText(d)
      const typeLabel = DIALOGUE_TYPE_LABELS[d.type] || d.type
      const prev = lastByChar[d.name]
      const linked = prev != null
        ? ` Balloon ${d.number} belongs to the same speaker as balloon ${prev} (${d.name}). They MUST be placed in SEPARATE, non-overlapping positions of the panel as shown in the layout image — do NOT stack, merge, or attach them. To show the connection, draw only a thin SOLID line between them (the comic "air" connector), never dashed or dotted. Keep a clear visible gap between these balloons and any balloon from another speaker.`
        : ''
      lastByChar[d.name] = d.number
      if (idx === 0) {
        lines.push(`${d.number}. "${d.label}" speaks FIRST: the balloon of "${d.label}" is placed ${placement} and contains exactly: "${d.text}". Balloon type: ${typeLabel}.`)
      } else {
        lines.push(`${d.number}. "${d.label}" responds: the balloon of "${d.label}" is placed ${placement} and contains exactly: "${d.text}". Balloon type: ${typeLabel}.${linked}`)
      }
    })

    lines.push('BALLOON STYLE AND LETTERING: strictly follow the balloon style defined in BALLOON GRAPHICS above; do not alter the wording, the lettering, or the balloon shape.')
  }

  return lines
}

export function generateScenePrompt(panel, characters = [], generalStyle, backgrounds = [], objects = [], stripAspectRatio = null, panelIndex = 0, strip = null, project = null, layoutFileName = null) {
  const ctx = computeContext(panel, characters, backgrounds, objects, stripAspectRatio, project)
  const layoutName = layoutFileName || layoutFileNameFor(strip, panelIndex)
  const projectStyle = projectStyleText(project)
  const styleText = (projectStyle && generalStyle) ? `${projectStyle}. ${generalStyle}` : (projectStyle || generalStyle || '')
  const lines = [
    ...headerLines(ctx, layoutName),
    ...stylePaletteLines(project, generalStyle),
    'LETTERING LOCK: This prompt describes the SCENE layer only, WITHOUT any dialogue or lettering. Do NOT draw any speech balloons, thought bubbles, narration boxes, captions, or sound-effect words. Do not write any text, letters, or typography anywhere in the image. Do not leave blank outlines, circles, or box placeholders hinting at future balloons. The scene must stand alone as a text-free panel; lettering is added later in a separate step.',
    '',
    ...sceneBodyLines(ctx, panel, styleText),
    '',
    `FINAL REMINDER: Generate a single comic panel in ${ctx.ratioLabel} aspect ratio with clear composition, correct layering, and spatial relationships preserved, and with NO text, lettering, or balloons of any kind. Use "${layoutName}" strictly as a spatial guide for where each scene element sits — do NOT copy its figures, lines, or graphic aspects. DO NOT CHANGE THE ASPECT RATIO.`,
  ]
  return lines.join('\n')
}

export function generateLetteringPrompt(panel, characters = [], generalStyle, backgrounds = [], objects = [], stripAspectRatio = null, panelIndex = 0, strip = null, project = null, layoutFileName = null) {
  const ctx = computeContext(panel, characters, backgrounds, objects, stripAspectRatio, project)
  const layoutName = layoutFileName || layoutFileNameFor(strip, panelIndex)
  const lines = [
    `IMAGE FORMAT: ${ctx.ratioLabel}. The final canvas must have exactly a ${ctx.ratioLabel} width:height ratio. Do not generate any other ratio, and do not crop, distort, or rotate.`,
    `POSITIONAL LAYOUT: The file "${layoutName}" is a layout reference image showing the exact positions, sizes, and order of the lettering elements (balloons, narration, sound effects) on the canvas. Use it as a precise guide.`,
    '',
    'SCENE LOCK: You are given the finished scene image generated in the previous step (attach it as the input image). Keep EVERYTHING in that scene EXACTLY as it is — do NOT redraw, recolor, move, resize, or alter any character, object, background, lighting, expression, line style, or detail. Do NOT change the composition or the aspect ratio. ONLY add the lettering elements described below, placed precisely where indicated.',
    '',
    ...letteringLines(ctx, panel, project, layoutName),
    '',
    `FINAL REMINDER — LETTERING ONLY: Keep the scene image unchanged and add ONLY the lettering specified above (balloons, narration, sound effects), at the exact coordinates given and following "${layoutName}" for placement. Do not modify anything else. DO NOT CHANGE THE ASPECT RATIO.`,
    `FINAL CHECK — LEGIBILITY AND BALLOON STYLE: Before finishing, verify that the specified typography and its lettering style are fully legible, and that every balloon is crafted to respect the specified style — subtle and restrained, not exaggerated. Also check that each balloon emerges correctly from the character it belongs to, and that when a character has more than one balloon they are joined to each other by the typical comic "air" connector used between consecutive balloons of the same speaker.`,
  ]
  return lines.join('\n')
}

export function generatePanelPrompt(panel, characters = [], generalStyle, backgrounds = [], objects = [], stripAspectRatio = null, panelIndex = 0, strip = null, project = null) {
  const ctx = computeContext(panel, characters, backgrounds, objects, stripAspectRatio, project)
  const layoutName = layoutFileNameFor(strip, panelIndex)
  const projectStyle = projectStyleText(project)
  const styleText = (projectStyle && generalStyle) ? `${projectStyle}. ${generalStyle}` : (projectStyle || generalStyle || '')
  const lines = [
    ...headerLines(ctx, layoutName),
    ...stylePaletteLines(project, generalStyle),
    ...sceneBodyLines(ctx, panel, styleText),
    ...letteringLines(ctx, panel, project, layoutName),
    '',
    `FINAL REMINDER: Generate a single comic panel in ${ctx.ratioLabel} aspect ratio with clear composition, correct layering, and spatial relationships preserved. Use "${layoutName}" strictly as a spatial guide for where each element (including balloons) sits — do NOT copy its figures, lines, or graphic aspects. DO NOT CHANGE THE ASPECT RATIO.`,
    `FINAL CHECK — LEGIBILITY AND BALLOON STYLE: Before finishing, verify that the specified typography and its lettering style are fully legible, and that every balloon is crafted to respect the specified style — subtle and restrained, not exaggerated. Also check that each balloon emerges correctly from the character it belongs to, and that when a character has more than one balloon they are joined to each other by the typical comic "air" connector used between consecutive balloons of the same speaker.`,
  ]
  return lines.join('\n')
}

export function generateAllPanelsPrompt(strip, characters = [], backgrounds = [], objects = [], project = null) {
  const chars = Array.isArray(characters) ? characters : []
  const bgs = Array.isArray(backgrounds) ? backgrounds : []
  const objs = Array.isArray(objects) ? objects : []
  return (strip?.panels || []).map((panel, index) => {
    const prompt = generatePanelPrompt(panel, chars, strip.generalStyle, bgs, objs, strip.aspectRatio, index, strip, project)
    return `=== PANEL ${index + 1} ===\n\n${prompt}`
  }).join('\n\n')
}
