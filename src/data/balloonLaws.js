export const BALLOON_LAW_GROUPS = [
  { id: 'cola', label: 'cola', hint: 'reglas sobre la cola del globo' },
  { id: 'forma', label: 'forma', hint: 'reglas sobre el contorno y la silueta' },
  { id: 'tipografia', label: 'tipografía', hint: 'reglas sobre el texto dentro del globo' },
  { id: 'consistencia', label: 'consistencia', hint: 'reglas de coherencia entre globos' },
]

export const BALLOON_LAWS = [
  // --- COLA ---
  {
    id: 'A1', group: 'cola', control: 'check', default: true,
    labelES: 'Las colas nunca se cruzan ni se tocan',
    titleEN: 'crossing balloon tails',
    hint: 'Si no hay espacio, se superponen los globos, jamás las colas.',
    promptEN: 'Balloon tails must NEVER cross or touch each other; when unavoidable, overlap balloon bodies instead, never the tails.',
  },
  {
    id: 'A2', group: 'cola', control: 'check', default: true,
    labelES: 'La cola apunta a la cabeza del hablante',
    titleEN: 'tail pointing to the speaker\'s head',
    hint: 'La cola señala hacia la cabeza del personaje, no al pecho ni al cuerpo.',
    promptEN: 'Each balloon tail must point toward the head of the character who is speaking, never toward the chest or body.',
  },
  {
    id: 'A3', group: 'cola', control: 'select', default: 'constante',
    labelES: 'Ancho de la cola en su base',
    titleEN: 'consistent tail width at the base',
    options: [
      { value: 'constante', label: 'constante', promptEN: 'All balloon tails must have the SAME width where they meet the balloon, regardless of tail length or balloon size.' },
      { value: 'variable', label: 'variable', promptEN: '' },
    ],
  },
  {
    id: 'A4', group: 'cola', control: 'select', default: 'gradual',
    labelES: 'Afinación de la punta',
    titleEN: 'even tail taper',
    options: [
      { value: 'gradual', label: 'gradual', promptEN: 'Tails must taper evenly to the point (gradually decreasing width); never sharpen to a needle point.' },
      { value: 'aguja', label: 'en punta de aguja', promptEN: '' },
    ],
  },
  {
    id: 'A5', group: 'cola', control: 'select', default: 'economica',
    labelES: 'Longitud de la cola',
    titleEN: 'short/economical tails',
    options: [
      { value: 'economica', label: 'económica (corta)', promptEN: 'Tails must be as short and economical as possible; avoid unnecessarily long tails.' },
      { value: 'media', label: 'media', promptEN: '' },
      { value: 'larga', label: 'larga', promptEN: 'Tails may be long.' },
    ],
  },
  // --- FORMA ---
  {
    id: 'B1', group: 'forma', control: 'select', default: 'organica-sutil',
    labelES: 'Forma del globo',
    titleEN: 'organic subtle balloon shape',
    options: [
      { value: 'organica-sutil', label: 'orgánica sutil', promptEN: 'Balloons must have an organic, slightly imperfect hand-drawn shape — NOT a sterile perfect ellipse; keep the imperfection subtle, never a "monster" or "drunk" balloon.' },
      { value: 'ovalo-perfecto', label: 'óvalo perfecto', promptEN: 'Balloons must be smooth, near-perfect ovals.' },
      { value: 'organica-exagerada', label: 'orgánica exagerada', promptEN: 'Balloons may be heavily irregular and jittery.' },
    ],
  },
  {
    id: 'B2', group: 'forma', control: 'select', default: 'grueso',
    labelES: 'Grosor del contorno',
    titleEN: 'thick balloon outline',
    options: [
      { value: 'grueso', label: 'grueso', promptEN: 'The balloon outline stroke must be thick and heavy (visibly bold), never thin.' },
      { value: 'medio', label: 'medio', promptEN: 'The balloon outline stroke should be of medium weight.' },
      { value: 'fino', label: 'fino', promptEN: 'The balloon outline stroke should be thin.' },
    ],
  },
  {
    id: 'B3', group: 'forma', control: 'check', default: true,
    labelES: 'Los globos pueden superponerse, las colas no',
    titleEN: 'overlapping balloon bodies (never tails)',
    hint: 'Al apilar, el globo que se lee primero va arriba.',
    promptEN: 'Balloons may overlap each other (stack their bodies if needed), but their tails must NEVER overlap or cross; when stacking, the balloon read earlier sits on top.',
  },
  {
    id: 'B4', group: 'forma', control: 'check', default: true,
    labelES: 'No tapar caras ni figuras',
    titleEN: 'not covering faces or figures',
    hint: 'Si un globo tapa arte, que tape lo mínimo.',
    promptEN: 'Do not cover faces or important figure details with balloons; if a balloon must cover artwork, cover as little as possible.',
  },
  {
    id: 'B5', group: 'forma', control: 'check', default: true,
    labelES: 'Fuera de la línea de mirada',
    titleEN: 'keeping balloons out of the line of sight',
    hint: 'Sobre todo entre dos personajes que se miran.',
    promptEN: 'Do not place balloons inside a character\'s line-of-sight, especially between two characters facing each other in conversation.',
  },
  {
    id: 'B6', group: 'forma', control: 'check', default: false,
    labelES: 'Recortar contra el borde del panel',
    titleEN: 'cropping balloons against the panel border',
    hint: 'El globo toca el marco del cuadro cuando sea posible.',
    promptEN: 'Crop balloons against the panel border whenever possible (balloon edge touching the panel frame).',
  },
  // --- TIPOGRAFÍA ---
  {
    id: 'C1', group: 'tipografia', control: 'check', default: true,
    labelES: 'Texto apilado en ovoide',
    titleEN: 'ovoid text stacking',
    hint: 'Corto arriba y abajo, ancho al medio; sin líneas con una sola palabra.',
    promptEN: 'Stack text inside each balloon in an ovoid shape: shorter lines at top and bottom, wider in the middle; never leave a lone tiny word on a line.',
  },
  {
    id: 'C2', group: 'tipografia', control: 'check', default: true,
    labelES: 'La palabra larga va al centro',
    titleEN: 'longest word in the middle line',
    hint: 'En la línea más ancha del globo; no partir palabras.',
    promptEN: 'Place the longest word on the widest (middle) line of the balloon; do not hyphenate words.',
  },
  {
    id: 'C3', group: 'tipografia', control: 'select', default: 'normal',
    labelES: 'Margen interno y aire',
    titleEN: 'one-letter padding and comfortable line spacing',
    options: [
      { value: 'normal', label: 'normal (una mayúscula)', promptEN: 'Leave roughly one capital-letter-width of empty space between the text and the balloon outline, and comfortable line spacing: lines must not touch but must not float apart.' },
      { value: 'estrecho', label: 'estrecho', promptEN: 'Keep the padding between text and the balloon outline tight, with compact line spacing.' },
      { value: 'amplio', label: 'amplio', promptEN: 'Leave generous padding between the text and the balloon outline, with airy line spacing.' },
    ],
  },
  {
    id: 'C4', group: 'tipografia', control: 'check', default: true,
    labelES: 'Espacio negativo equilibrado (94%)',
    titleEN: 'balanced negative space (94% compression)',
    hint: 'Comprimir líneas largas como máximo al 94%.',
    promptEN: 'Keep the negative space inside each balloon visually balanced; if a line is too long, compress it horizontally to at most 94% of its width.',
  },
  {
    id: 'C5', group: 'tipografia', control: 'check', default: true,
    labelES: 'Siempre mayúsculas; la "I" pronombre con serif',
    titleEN: 'uppercase lettering with barred capital I',
    promptEN: 'Letter all dialogue in UPPERCASE hand-lettering; the personal pronoun "I" and acronyms use a serif/barred capital I, other "I" letters a plain single-stroke capital I.',
  },
  {
    id: 'C6', group: 'tipografia', control: 'multi', default: [],
    labelES: 'Cursiva para',
    titleEN: 'italics usage',
    options: [
      { value: 'thought', label: 'pensamiento', promptEN: 'Thought-balloon text must be italic and slightly smaller.' },
      { value: 'whisper', label: 'susurro', promptEN: 'Whispered dialogue must be italic and slightly smaller.' },
      { value: 'foreign', label: 'palabras extranjeras', promptEN: 'Foreign words must be italicized.' },
      { value: 'radio', label: 'radio / teléfono', promptEN: 'Radio, telephone or walkie-talkie transmissions must be italicized.' },
      { value: 'titles', label: 'títulos de obras', promptEN: 'Book, movie and song titles must be italicized.' },
      { value: 'song', label: 'cantos', promptEN: 'Sung dialogue must be italicized.' },
    ],
  },
  {
    id: 'C7', group: 'tipografia', control: 'check', default: true,
    labelES: 'Comillas dobles curvas',
    titleEN: 'double curly quotation marks',
    hint: 'Citar dentro del globo usa comillas dobles (nunca simples).',
    promptEN: 'When dialogue quotes another person inside a balloon, use double quotation marks (never single quotes inside balloons); use curly/typographic quotes, not straight ones.',
  },
  {
    id: 'C8', group: 'tipografia', control: 'check', default: true,
    labelES: 'Elipsis y doble guion sin espacios',
    titleEN: 'ellipses and double dashes fidelity',
    hint: '… = voz que se apaga; -- = interrupción.',
    promptEN: 'Preserve ellipses (…) as speech trailing off and double dashes (--) as interruptions exactly as written, with NO spaces around or between them; if speech continues into a linked balloon of the same speaker, that balloon must begin with the same sign.',
  },
  // --- CONSISTENCIA ---
  {
    id: 'D1', group: 'consistencia', control: 'check', default: true,
    labelES: 'Globos de pensamiento consistentes',
    titleEN: 'consistent thought-balloon bulges',
    hint: 'Bultos iguales de tamaño y separación; sin estirar un globo.',
    promptEN: 'Thought-balloon cloud bulges must be consistent in size and spacing within each balloon and across balloons; draw each thought balloon sized proportionally to its text, never stretching one to fit.',
  },
  {
    id: 'D2', group: 'consistencia', control: 'check', default: true,
    labelES: 'Estilo consistente en toda la página',
    titleEN: 'consistent balloon style across the page',
    promptEN: 'Keep balloon style fully consistent across the whole page: same outline weight, same tail width at the base, same internal padding.',
  },
  {
    id: 'D3', group: 'consistencia', control: 'check', default: true,
    labelES: 'Orden de lectura nunca ambiguo',
    titleEN: 'unambiguous reading order',
    hint: 'Arriba→abajo, izquierda→derecha; nunca cruzar colas para arreglarlo.',
    promptEN: 'Reading order must never be ambiguous: balloons read top-to-bottom, then left-to-right; if the character speaking first sits on the right, rearrange balloon positions so order stays clear — never cross tails to fix it.',
  },
]

export function makeDefaultBalloonLaws() {
  const laws = {}
  BALLOON_LAWS.forEach(law => { laws[law.id] = law.default })
  return laws
}

export function balloonLawsToPrompt(laws = {}) {
  const sentences = []
  for (const law of BALLOON_LAWS) {
    const value = laws[law.id] ?? law.default
    if (law.control === 'check') {
      if (value) sentences.push(law.promptEN)
    } else if (law.control === 'select') {
      const opt = law.options.find(o => o.value === value) || law.options[0]
      if (opt && opt.promptEN) sentences.push(opt.promptEN)
    } else if (law.control === 'multi') {
      ;(Array.isArray(value) ? value : []).forEach(v => {
        const opt = law.options.find(o => o.value === v)
        if (opt && opt.promptEN) sentences.push(opt.promptEN)
      })
    }
  }
  return sentences
}

export function balloonLawDiffSentences(laws = {}) {
  const defaultLaws = makeDefaultBalloonLaws()
  const additions = []
  const exemptions = []
  for (const law of BALLOON_LAWS) {
    const value = laws[law.id] ?? defaultLaws[law.id]
    const def = defaultLaws[law.id]
    if (law.control === 'check') {
      if (value === def) continue
      if (value) additions.push(law.promptEN)
      else exemptions.push(`Exempt from: ${law.titleEN}.`)
    } else if (law.control === 'select') {
      if (value === def) continue
      const opt = law.options.find(o => o.value === value)
      if (opt?.promptEN) additions.push(opt.promptEN)
      else exemptions.push(`Exempt from: ${law.titleEN}.`)
    } else if (law.control === 'multi') {
      const arr = Array.isArray(value) ? value : []
      const defArr = Array.isArray(def) ? def : []
      arr.filter(v => !defArr.includes(v)).forEach(v => {
        const opt = law.options.find(o => o.value === v)
        if (opt?.promptEN) additions.push(opt.promptEN)
      })
      defArr.filter(v => !arr.includes(v)).forEach(v => {
        const opt = law.options.find(o => o.value === v)
        if (opt) exemptions.push(`Exempt from: ${opt.label} in italics.`)
      })
    }
  }
  return { additions, exemptions }
}

export function lawsEqual(a = {}, b = {}) {
  const ka = Object.keys(a).sort()
  const kb = Object.keys(b).sort()
  return ka.length === kb.length && ka.every((k, i) => kb[i] === k && a[k] === b[k])
}
