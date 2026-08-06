export const ACTION_PRESETS = [
  'sentado', 'parado', 'caminando', 'corriendo',
  'acostado', 'saltando', 'girando la cabeza',
  'señalando', 'riendo', 'llorando',
  'comiendo', 'bebiendo', 'leyendo',
  'abrazando', 'empujando', 'tirando',
  'esperando', 'durmiendo', 'cocinando',
  'escribiendo', 'hablando por teléfono',
]

export const ACTION_EFFECTS = {
  'corriendo':         { motionLines: 'speed',  sfx: '⚡' },
  'saltando':          { motionLines: 'jump',   sfx: 'BOING' },
  'caminando':         { motionLines: 'walk',   sfx: null },
  'empujando':         { motionLines: 'push',   sfx: 'GRRR' },
  'tirando':           { motionLines: 'throw',  sfx: 'WHOOSH' },
  'riendo':            { motionLines: null,      sfx: 'JA JA JA' },
  'llorando':          { motionLines: null,      sfx: 'SNIFF' },
  'girando la cabeza': { motionLines: 'turn',   sfx: null },
  'comiendo':          { motionLines: null,      sfx: 'NOM' },
  'bebiendo':          { motionLines: null,      sfx: 'GLOT GLOT' },
  'abrazando':         { motionLines: null,      sfx: null },
  'sentado':           { motionLines: null,      sfx: null },
  'parado':            { motionLines: null,      sfx: null },
  'acostado':          { motionLines: null,      sfx: null },
  'señalando':         { motionLines: null,      sfx: null },
  'leyendo':           { motionLines: null,      sfx: null },
  'esperando':         { motionLines: null,      sfx: null },
  'durmiendo':         { motionLines: null,      sfx: 'Zzz' },
  'cocinando':         { motionLines: null,      sfx: 'SIZZLE' },
  'escribiendo':       { motionLines: null,      sfx: null },
  'hablando por teléfono': { motionLines: null,  sfx: null },
}

export const MOTION_LINE_DESCS = {
  speed: 'líneas de velocidad horizontales detrás del personaje',
  jump:  'líneas de movimiento verticales indicando salto',
  walk:  'pequeñas líneas de movimiento en los pies',
  push:  'líneas de fuerza horizontal apuntando al objeto',
  throw: 'líneas curvas de trayectoria siguiendo el movimiento',
  turn:  'líneas curvas alrededor de la cabeza indicando giro',
}

export const SFX_STYLES = [
  { id: 'explosion', label: 'explosión' },
  { id: 'impact', label: 'impacto' },
  { id: 'whisper', label: 'susurro' },
  { id: 'speed', label: 'velocidad' },
  { id: 'default', label: 'normal' },
]

export const HATCH_TYPES = [
  { id: 'halftone',   label: 'halftone',   desc: 'puntos gradados estilo pop art' },
  { id: 'crosshatch', label: 'crosshatch',  desc: 'líneas cruzadas de sombra' },
  { id: 'speed',      label: 'rayas',       desc: 'líneas paralelas de movimiento' },
  { id: 'dots',       label: 'puntos',      desc: 'puntos distribuidos uniformemente' },
  { id: 'none',       label: 'sin trama',   desc: 'fondo liso' },
]

export const TIME_TRANSITIONS = [
  { id: 'immediate',    label: 'instante después' },
  { id: 'seconds',      label: 'unos segundos después' },
  { id: 'minutes',      label: 'minutos después' },
  { id: 'hours',        label: 'horas después' },
  { id: 'days',         label: 'días después' },
  { id: 'flashback',    label: 'flashback' },
  { id: 'flashforward', label: 'flash-forward' },
]

export const DIALOGUE_TYPES = [
  { id: 'speech', label: 'habla', icon: '💬' },
  { id: 'thought', label: 'piensa', icon: '💭' },
  { id: 'shout', label: 'grita', icon: '📢' },
  { id: 'whisper', label: 'susurra', icon: '🤫' },
]

export const DIRECTIONS = [
  { id: 'left', label: '←', name: 'izquierda' },
  { id: 'right', label: '→', name: 'derecha' },
  { id: 'front', label: '↓', name: 'frente' },
  { id: 'back', label: '↑', name: 'espalda' },
]

export const SHOT_TYPES = [
  { id: 'close-up', label: 'close-up', name: 'primer plano', desc: 'encuadre muy ajustado, solo rostro o detalle' },
  { id: 'horizon-high', label: '3/4', name: 'horizonte alto', desc: 'encuadre en 3 cuartos, figura dominante, fondo presente' },
  { id: 'horizon-mid', label: '1/2', name: 'plano medio', desc: 'encuadre a la mitad, figuren y fondo en equilibrio' },
  { id: 'horizon-low', label: '1/4', name: 'horizonte bajo', desc: 'encuadre abierto, figura pequeña, gran parte del fondo visible' },
  { id: 'wide', label: 'wide', name: 'plano general', desc: 'encuadre amplio, escena completa, personajes pequeños' },
]

export const ASPECT_RATIOS = [
  { id: 'hd',        label: 'HD',        ratio: '16:9', desc: 'formato horizontal panorámico', css: '16/9' },
  { id: 'square',    label: 'Cuadrada',  ratio: '1:1',  desc: 'formato cuadrado', css: '1/1' },
  { id: 'vertical',  label: 'Vertical',  ratio: '9:16', desc: 'formato vertical alto', css: '9/16' },
  { id: 'portrait-hd', label: 'Vertical HD', ratio: '9:16', desc: 'formato vertical panorámico', css: '9/16' },
]

export const ACTION_TARGET_HINTS = {
  'tirando':             { preferType: 'object' },
  'empujando':           { preferType: 'object' },
  'abrazando':           { preferType: 'character' },
  'señalando':           { preferType: 'any' },
  'leyendo':             { preferType: 'object' },
  'comiendo':            { preferType: 'object' },
  'bebiendo':            { preferType: 'object' },
  'hablando por teléfono': { preferType: 'object' },
  'cocinando':           { preferType: 'object' },
  'escribiendo':         { preferType: 'object' },
}
