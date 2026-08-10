export const ACTION_PRESETS = [
  'standing', 'sitting', 'walking', 'running',
]

export const ACTION_EFFECTS = {
  running:  { motionLines: 'speed',  sfx: '⚡' },
  jumping:  { motionLines: 'jump',   sfx: 'BOING' },
  walking:  { motionLines: 'walk',   sfx: null },
  pushing:  { motionLines: 'push',   sfx: 'GRRR' },
  throwing: { motionLines: 'throw',  sfx: 'WHOOSH' },
  laughing: { motionLines: null,      sfx: 'HA HA HA' },
  crying:   { motionLines: null,      sfx: 'SNIFF' },
  turning:  { motionLines: 'turn',   sfx: null },
  eating:   { motionLines: null,      sfx: 'NOM' },
  drinking: { motionLines: null,      sfx: 'GULP' },
  hugging:  { motionLines: null,      sfx: null },
  sitting:  { motionLines: null,      sfx: null },
  standing: { motionLines: null,      sfx: null },
  lying:    { motionLines: null,      sfx: null },
  pointing: { motionLines: null,      sfx: null },
  reading:  { motionLines: null,      sfx: null },
  waiting:  { motionLines: null,      sfx: null },
  sleeping: { motionLines: null,      sfx: 'Zzz' },
  cooking:  { motionLines: null,      sfx: 'SIZZLE' },
  writing:  { motionLines: null,      sfx: null },
  'talking on phone': { motionLines: null, sfx: null },
}

export const MOTION_LINE_DESCS = {
  speed: 'horizontal speed lines behind the character',
  jump:  'vertical motion lines indicating a jump',
  walk:  'small motion lines at the feet',
  push:  'horizontal force lines pointing at the object',
  throw: 'curved trajectory lines following the motion',
  turn:  'curved lines around the head indicating a turn',
}

export const SFX_STYLES = [
  { id: 'explosion', label: 'explosion' },
  { id: 'impact', label: 'impact' },
  { id: 'whisper', label: 'whisper' },
  { id: 'speed', label: 'speed' },
  { id: 'default', label: 'normal' },
]

export const HATCH_TYPES = [
  { id: 'halftone',   label: 'halftone',   desc: 'graduated dots, pop art style' },
  { id: 'crosshatch', label: 'crosshatch',  desc: 'crossed shadow lines' },
  { id: 'speed',      label: 'speed lines', desc: 'parallel motion lines' },
  { id: 'dots',       label: 'dots',        desc: 'evenly distributed dots' },
  { id: 'none',       label: 'no hatching', desc: 'plain background' },
]

export const TIME_TRANSITIONS = [
  { id: 'immediate',    label: 'right after' },
  { id: 'seconds',      label: 'a few seconds later' },
  { id: 'minutes',      label: 'minutes later' },
  { id: 'hours',        label: 'hours later' },
  { id: 'days',         label: 'days later' },
  { id: 'flashback',    label: 'flashback' },
  { id: 'flashforward', label: 'flash-forward' },
]

export const DIALOGUE_TYPES = [
  { id: 'speech', label: 'speech', icon: 'speech' },
  { id: 'thought', label: 'thought', icon: 'thought' },
  { id: 'shout', label: 'shout', icon: 'shout' },
  { id: 'whisper', label: 'whisper', icon: 'whisper' },
]

export const DIRECTIONS = [
  { id: 'left', label: '←', name: 'left' },
  { id: 'right', label: '→', name: 'right' },
  { id: 'front', label: '↓', name: 'front' },
  { id: 'back', label: '↑', name: 'back' },
  { id: 'up-left', label: '↖', name: 'upper left' },
  { id: 'up-right', label: '↗', name: 'upper right' },
  { id: 'down-left', label: '↙', name: 'lower left' },
  { id: 'down-right', label: '↘', name: 'lower right' },
]

export const SHOT_TYPES = [
  { id: 'close-up', label: 'close-up', name: 'close-up', desc: 'tight framing, face or detail only', scope: 'character' },
  { id: 'horizon-high', label: '3/4', name: 'three-quarter shot', desc: 'three-quarter framing, dominant figure, background present', scope: 'character' },
  { id: 'horizon-mid', label: '1/2', name: 'medium shot', desc: 'waist-up framing, figure and background in balance', scope: 'character' },
  { id: 'horizon-low', label: '1/4', name: 'low horizon', desc: 'open framing, small figure, large background visible', scope: 'scene' },
  { id: 'wide', label: 'wide', name: 'wide shot', desc: 'wide framing, full scene, small characters', scope: 'scene' },
]

export const ASPECT_RATIOS = [
  { id: 'hd',        label: 'HD',        ratio: '16:9', desc: 'widescreen horizontal format', css: '16/9' },
  { id: 'square',    label: 'Square',    ratio: '1:1',  desc: 'square format', css: '1/1' },
  { id: 'vertical',  label: 'Vertical',  ratio: '9:16', desc: 'tall vertical format', css: '9/16' },
  { id: 'portrait-hd', label: 'Vertical HD', ratio: '9:16', desc: 'vertical widescreen format', css: '9/16' },
]

export const ACTION_TARGET_HINTS = {
  throwing:            { preferType: 'object' },
  pushing:             { preferType: 'object' },
  hugging:             { preferType: 'character' },
  pointing:            { preferType: 'any' },
  reading:             { preferType: 'object' },
  eating:              { preferType: 'object' },
  drinking:            { preferType: 'object' },
  'talking on phone':  { preferType: 'object' },
  cooking:             { preferType: 'object' },
  writing:             { preferType: 'object' },
}
