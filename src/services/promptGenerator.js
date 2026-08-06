import { DIALOGUE_TYPES, DIRECTIONS, SHOT_TYPES, HATCH_TYPES, TIME_TRANSITIONS, MOTION_LINE_DESCS, ACTION_EFFECTS, ASPECT_RATIOS } from '../data/actionPresets'

function describePosition(x = 0, y = 0, width = 0, height = 0) {
  const centerX = x + width / 2
  const centerY = y + height / 2
  const horizontal = centerX < 0.33 ? 'izquierda' : centerX > 0.66 ? 'derecha' : 'centro'
  const vertical = centerY < 0.33 ? 'arriba' : centerY > 0.66 ? 'abajo' : 'centro vertical'
  const area = width * height
  const size = area < 0.04 ? 'muy pequeño' : area < 0.08 ? 'pequeño' : area < 0.18 ? 'mediano' : area < 0.3 ? 'grande' : 'dominante'
  return { position: `${vertical}, ${horizontal}`, size }
}

function describeLandscapePlacement(background) {
  const { x = 0, y = 0, width = 1, height = 0.5 } = background
  const centerX = x + width / 2
  const centerY = y + height / 2
  const area = width * height

  // A landscape has pictorial depth semantics, not character-style placement.
  if (area >= 0.42 && width >= 0.65) {
    return 'paisaje envolvente y abierto: los personajes están DENTRO del paisaje, rodeados por él. El paisaje se extiende hasta los bordes del cuadro y CONTINÚA más allá de lo visible. NO es una imagen insertada, encapsulada, flotante, enmarcada ni con bordes. El paisaje ES el espacio, no una decoración pegada.'
  }
  if (centerY >= 0.62) {
    if (centerX < 0.35) return 'paisaje en primer plano a la izquierda, como un telón matérico que se extiende desde el borde izquierdo del cuadro; los personajes están DENTRO de este espacio, no delante de una imagen. NO es una imagen flotante ni un cuadro con marco.'
    if (centerX > 0.65) return 'paisaje en primer plano a la derecha, como un telón matérico que se extiende desde el borde derecho del cuadro; los personajes están DENTRO de este espacio, no delante de una imagen. NO es una imagen flotante ni un cuadro con marco.'
    return 'paisaje en primer plano abajo, como un telón matérico que se extiende desde el borde inferior del cuadro; los personajes están DENTRO de este espacio, no delante de una imagen. NO es una imagen flotante ni un cuadro con marco.'
  }
  if (centerY <= 0.4 && area < 0.42) {
    return 'paisaje lejano en la parte superior, como una lejanía pictórica al estilo de una pintura china; se desvanece hacia el borde superior del cuadro. NO rodea a los personajes, NO es un objeto pegado ni una imagen con marco.'
  }
  return 'paisaje parcial en profundidad, integrado en la escena y limitado a la zona indicada; se extiende naturalmente sin marcos ni bordes visibles. NO dibujar un contorno alrededor.'
}

function describeGridAlignment(x, y, width, height, grid = 'thirds') {
  const cx = x + width / 2
  const cy = y + height / 2
  const columns = grid === 'halves' ? ['izquierda', 'derecha'] : ['izquierda', 'centro', 'derecha']
  const rows = grid === 'halves' ? ['superior', 'inferior'] : ['superior', 'central', 'inferior']
  const col = columns[Math.min(columns.length - 1, Math.floor(cx * columns.length))]
  const row = rows[Math.min(rows.length - 1, Math.floor(cy * rows.length))]
  return `${row} ${col} de la grilla de ${grid === 'halves' ? 'mitades' : 'tercios'}`
}

function coordinates(item) {
  return `x ${Math.round(item.x * 100)}%, y ${Math.round(item.y * 100)}%, ancho ${Math.round(item.width * 100)}%, alto ${Math.round(item.height * 100)}%`
}

function formatRule(stripAspectRatio) {
  const ar = ASPECT_RATIOS.find(item => item.id === stripAspectRatio)
  if (!ar) return 'REGLA DE FORMATO: conservar exactamente la proporción definida por la imagen de salida.'
  return `FORMATO DE SALIDA OBLIGATORIO: ${ar.ratio} (${ar.label}, ${ar.desc}). El lienzo final debe tener exactamente una relación de ancho:alto ${ar.ratio}. No generar 1:1, 16:9, 9:16 ni otra proporción alternativa. No recortar, deformar ni convertir la orientación. Diseñar toda la composición dentro de este rectángulo.`
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
    ? ` Referencia visual adjunta: ${entity.referenceImages.map(image => image.fileName).join(', ')}. Usar para conservar identidad, forma, materiales y rasgos distintivos.`
    : ''
}

export function generatePanelPrompt(panel, characters, generalStyle, backgrounds = [], objects = [], stripAspectRatio = null) {
  const lines = []
  const panelCharacters = panel.characters || []
  const panelConnections = panel.connections || []
  const outgoing = new Map()
  const connectedCharacters = new Set()

  panelConnections.forEach(connection => {
    const targetName = connectionTargetName(connection, characters, objects, backgrounds)
    const source = characters.find(item => item.id === connection.from)
    if (source && targetName) {
      outgoing.set(source.id, targetName)
      connectedCharacters.add(source.id)
      if ((connection.toType || 'character') === 'character') connectedCharacters.add(connection.to)
    }
  })

  // Global constraints come first so the image model sees them before details.
  const ar = ASPECT_RATIOS.find(item => item.id === stripAspectRatio)
  lines.push(`IMAGEN ${ar ? ar.label.toUpperCase() : ''} ${ar ? ar.ratio : ''}. LA IMAGEN DEBE TENER EXACTAMENTE PROPORCIÓN ${ar ? ar.ratio : 'definida'}. NO OTRA PROPORCIÓN. NO RECORTAR. NO DEFORMAR.`)
  lines.push('')
  lines.push('INSTRUCCIONES DE COMPOSICION PARA UNA HISTORIETA')
  lines.push(formatRule(stripAspectRatio))
  lines.push('REGLA DE LECTURA: respetar posiciones, tamaños, profundidad, relaciones y orden de capas indicados a continuación.')
  lines.push('')

  if (generalStyle) {
    lines.push(`ESTILO GLOBAL: ${generalStyle}`)
    lines.push('')
  }

  if (panel.timeTransition) {
    const transition = TIME_TRANSITIONS.find(item => item.id === panel.timeTransition)
    if (transition) lines.push(`CONTINUIDAD TEMPORAL: ${transition.label}.`)
  }
  if (panel.scene) lines.push(`ESCENA: ${panel.scene}`)
  lines.push(`GUIA DE COMPOSICION: usar una grilla de ${panel.grid === 'halves' ? 'mitades (1 línea vertical y 1 horizontal)' : 'tercios (2 líneas verticales y 2 horizontales)'} como motor de ubicación; las guías no se dibujan en la imagen final.`)
  if (panel.horizon) lines.push(`LINEA DE HORIZONTE: altura ${Math.round(panel.horizon.y * 100)}% del cuadro.${panel.horizon.description ? ` Descripción: ${panel.horizon.description}.` : ''} Dibujarla detrás del paisaje, personajes y objetos.`)

  if (panel.shotType) {
    const shot = SHOT_TYPES.find(item => item.id === panel.shotType)
    if (shot) lines.push(`CAMARA Y ENCUADRE: ${shot.name}. ${shot.desc}.`)
  }
  if (panel.hatch && panel.hatch !== 'none') {
    const hatch = HATCH_TYPES.find(item => item.id === panel.hatch)
    if (hatch) lines.push(`TRATAMIENTO GRAFICO: ${hatch.name}; ${hatch.desc}.`)
  }

  lines.push('')
  lines.push('CAPAS Y PROFUNDIDAD:')
  if (panel.backgroundId) {
    const backgroundDef = backgrounds.find(item => item.id === panel.backgroundId)
    if (backgroundDef) {
      const background = panel.background || { x: 0, y: 0, width: 1, height: 0.5 }
      const placement = describeLandscapePlacement(background)
      lines.push(`- PAISAJE, CAPA ESPACIAL: "${backgroundDef.name}". ${backgroundDef.promptText}.${referenceText(backgroundDef)} ${placement}. CRÍTICO: El paisaje es el espacio pictórico real dentro de la escena. NO es una viñeta, tarjeta, fotografía pegada ni objeto independiente. Los personajes y objetos están DENTRO del paisaje, no delante de una imagen. Su rectángulo conserva exactamente sus proporciones y su tamaño relativo en el cuadro.`)
    }
  } else {
    lines.push('- Sin paisaje definido: no inventar un fondo dominante.')
  }

  const panelObjects = panel.objects || []
  if (panelObjects.length > 0) {
    lines.push('')
    lines.push('OBJETOS EN ESCENA:')
    panelObjects.forEach(item => {
      const definition = objects.find(object => object.id === item.objectId)
      if (!definition) return
      const { position, size } = describePosition(item.x, item.y, item.width, item.height)
      lines.push(`- "${definition.name}": ${definition.promptText}.${referenceText(definition)}${item.note ? ` Sobre el objeto: ${item.note}.` : ''} Posición: ${position}. Coordenadas y tamaño: ${coordinates(item)}. Alineación: ${describeGridAlignment(item.x, item.y, item.width, item.height, panel.grid)}. Tamaño relativo: ${size}. Capa delante del fondo.`)
    })
  }

  lines.push('')
  lines.push('PERSONAJES Y ACCIONES:')
  const characterOccurrences = new Map()
  panelCharacters.forEach(item => {
    const definition = characters.find(character => character.id === item.characterId)
    if (!definition) return
    const occurrence = (characterOccurrences.get(item.characterId) || 0) + 1
    characterOccurrences.set(item.characterId, occurrence)
    const instanceName = `${definition.name} ${occurrence}`
    const { position, size } = describePosition(item.x, item.y, item.width, item.height)
    lines.push(`- PERSONAJE "${instanceName}": ${definition.promptText}.${referenceText(definition)} Posición exacta: ${position}. Coordenadas y tamaño: ${coordinates(item)}. Alineación: ${describeGridAlignment(item.x, item.y, item.width, item.height, panel.grid)}. Tamaño relativo: ${size}.`)
    if (item.expression) lines.push(`  Expresión: ${item.expression}.`)
    if (item.actions?.length > 0) {
      lines.push(`  Acción: ${item.actions.join(', ')}.`)
      item.actions.forEach(action => {
        const effect = ACTION_EFFECTS[action]
        const description = effect?.motionLines && MOTION_LINE_DESCS[effect.motionLines]
        if (description) lines.push(`  Efecto visual de la acción: ${description}.`)
      })
    }

    // A connection is the authoritative gaze instruction; never emit a conflicting side direction.
    if (outgoing.has(item.characterId)) {
      lines.push(`  MIRADA Y RELACION: ${instanceName} observa a ${outgoing.get(item.characterId)}.`)
    } else if (!connectedCharacters.has(item.characterId)) {
      const direction = DIRECTIONS.find(value => value.id === item.direction)
      if (direction) lines.push(`  Orientación corporal: ${direction.name}.`)
    }

    if (item.dialogue) {
      const type = DIALOGUE_TYPES.find(value => value.id === item.dialogueType)
      const verb = type?.id === 'thought' ? 'piensa' : type?.id === 'shout' ? 'grita' : type?.id === 'whisper' ? 'susurra' : 'dice'
      lines.push(`  Texto: ${instanceName} ${verb}: "${item.dialogue}".`)
    }
  })

  if (panelConnections.length > 0) {
    lines.push('')
    lines.push('RELACIONES VISUALES OBLIGATORIAS:')
    panelConnections.forEach(connection => {
      const source = characters.find(item => item.id === connection.from)
      const target = connectionTargetName(connection, characters, objects, backgrounds)
      if (source && target) lines.push(`- ${source.name} observa a ${target}. La mirada y la atención visual deben dirigirse hacia ese objetivo.`)
    })
  }

  const panelSfx = panel.sfx || []
  const hasNarration = panel.narration && panel.narration.text
  if (hasNarration || panelSfx.some(item => item.text)) {
    lines.push('')
    lines.push('TEXTOS Y ELEMENTOS GRAFICOS:')
    if (hasNarration) {
      const narr = panel.narration
      const { position, size } = describePosition(narr.x, narr.y, narr.width, narr.height)
      const style = narr.framed ? 'EN RECUADRO' : 'TEXTO SUELTO'
      lines.push(`- Narración [${style}]: "${narr.text}". Posición: ${position}. Coordenadas y tamaño: ${coordinates(narr)}. Alineación: ${describeGridAlignment(narr.x, narr.y, narr.width, narr.height, panel.grid)}. Tamaño relativo: ${size}.${narr.framed ? ' Texto dentro de un recuadro con borde visible.' : ' Texto flotante sin recuadro.'}`)
    }
    panelSfx.forEach(item => {
      if (!item.text) return
      const { position, size } = describePosition(item.x, item.y, item.width, item.height)
      lines.push(`- Onomatopeya "${item.text}": posición ${position}, tamaño ${size}, estilo ${item.style}.`)
    })
  }

  // Narration gaze references
  if (hasNarration) {
    panelCharacters.forEach(item => {
      if (item.gazeTarget?.type === 'narration') {
        const definition = characters.find(character => character.id === item.characterId)
        if (definition) {
          const occurrence = characterOccurrences.get(item.characterId) || 1
          lines.push(`  MIRADA: ${definition.name} ${occurrence} observa el cuadro de narración.`)
        }
      }
    })
  }

  // Position map
  const mapElements = []
  if (panel.narration && panel.narration.text) {
    const narr = panel.narration
    mapElements.push({ label: 'N', name: 'narración', cx: narr.x + narr.width / 2, cy: narr.y + narr.height / 2 })
  }
  if (panel.backgroundId) {
    const bg = panel.background || { x: 0, y: 0, width: 1, height: 0.5 }
    mapElements.push({ label: 'B', name: 'fondo', cx: bg.x + bg.width / 2, cy: bg.y + bg.height / 2 })
  }
  panelCharacters.forEach((item, idx) => {
    const def = characters.find(c => c.id === item.characterId)
    if (def) mapElements.push({ label: `P${idx + 1}`, name: def.name, cx: item.x + item.width / 2, cy: item.y + item.height / 2 })
  })
  panelObjects.forEach((item, idx) => {
    const def = objects.find(o => o.id === item.objectId)
    if (def) mapElements.push({ label: `O${idx + 1}`, name: def.name, cx: item.x + item.width / 2, cy: item.y + item.height / 2 })
  })
  const panelSfxForMap = panel.sfx || []
  panelSfxForMap.forEach((item, idx) => {
    if (item.text) mapElements.push({ label: `S${idx + 1}`, name: item.text, cx: item.x + item.width / 2, cy: item.y + item.height / 2 })
  })

  if (mapElements.length > 0) {
    lines.push('')
    lines.push('MAPA DE POSICIONES:')
    const rows = ['arriba', 'centro vertical', 'abajo']
    const grid = [[], [], []]
    mapElements.forEach(el => {
      const col = el.cx < 0.33 ? 0 : el.cx > 0.66 ? 2 : 1
      const row = el.cy < 0.33 ? 0 : el.cy > 0.66 ? 2 : 1
      grid[row][col].push(`[${el.label}] ${el.name}`)
    })
    for (let r = 0; r < 3; r++) {
      const parts = []
      for (let c = 0; c < 3; c++) {
        parts.push(grid[r][c].length > 0 ? grid[r][c].join(', ') : '—')
      }
      lines.push(`  ${rows[r]}: ${parts.join(' | ')}`)
    }
  }

  lines.push('')
  lines.push(`RECORDATORIO FINAL: generar un único cuadro de historieta completo en proporción ${ASPECT_RATIOS.find(item => item.id === stripAspectRatio)?.ratio || 'definida'}, con composición clara, capas respetadas y sin alterar las relaciones indicadas. PROPORCIÓN DE SALIDA: ${ASPECT_RATIOS.find(item => item.id === stripAspectRatio)?.ratio || 'definida'}. NO CAMBIAR LA PROPORCIÓN.`)
  return lines.join('\n')
}

export function generateAllPanelsPrompt(strip, characters, backgrounds = [], objects = []) {
  return strip.panels.map((panel, index) => {
    const prompt = generatePanelPrompt(panel, characters, strip.generalStyle, backgrounds, objects, strip.aspectRatio)
    return `=== CUADRO ${index + 1} ===\n\n${prompt}`
  }).join('\n\n')
}
