import { ASPECT_RATIOS } from '../data/actionPresets'
import { orderedPanelDialogues } from './promptGenerator'

export function anchorTarget(gx, panel, characters, objects, svgW, svgH) {
  const a = gx.anchor || {}
  const bx = (gx.x + gx.width / 2) * svgW
  const by = (gx.y + gx.height / 2) * svgH
  switch (a.type) {
    case 'character': {
      const ch = (panel.characters || []).find(c => c.characterId === a.id)
      return ch ? { x: (ch.x + ch.width / 2) * svgW, y: (ch.y + ch.height * 0.3) * svgH } : null
    }
    case 'object': {
      const obj = (panel.objects || []).find(o => o.objectId === a.id)
      return obj ? { x: (obj.x + obj.width / 2) * svgW, y: (obj.y + obj.height / 2) * svgH } : null
    }
    case 'narration': {
      const n = panel.narration
      return n ? { x: (n.x + n.width / 2) * svgW, y: (n.y + n.height / 2) * svgH } : null
    }
    case 'offpanel': {
      const dir = a.direction || 'bottom'
      const edge = {
        left: { x: -8, y: by },
        right: { x: svgW + 8, y: by },
        top: { x: bx, y: -8 },
        bottom: { x: bx, y: svgH + 8 },
      }[dir] || { x: bx, y: svgH + 8 }
      return edge
    }
    default:
      return null
  }
}

export function generateLayoutSVG(panel, characters, backgrounds, objects, stripAspectRatio, mode = 'scene') {
  const ar = ASPECT_RATIOS.find(a => a.id === stripAspectRatio)
  const ratioParts = ar ? ar.ratio.split(':').map(Number) : [16, 9]
  const svgW = 400
  const svgH = Math.round(svgW * (ratioParts[1] / ratioParts[0]))

  const rects = []

  if (mode === 'scene') {
    if (panel.backgroundId) {
      const bg = panel.background || { x: 0, y: 0, width: 1, height: 0.5 }
      const def = backgrounds.find(b => b.id === panel.backgroundId)
      rects.push({ x: bg.x * svgW, y: bg.y * svgH, w: bg.width * svgW, h: bg.height * svgH, stroke: '#999', fill: 'rgba(0,0,0,0.04)', label: def?.name || 'fondo' })
    }

    ;(panel.characters || []).forEach((ch, i) => {
      const def = characters.find(c => c.id === ch.characterId)
      rects.push({ x: ch.x * svgW, y: ch.y * svgH, w: ch.width * svgW, h: ch.height * svgH, stroke: def?.color || '#333', fill: 'none', label: def?.name || `P${i + 1}` })
    })

    ;(panel.objects || []).forEach((obj, i) => {
      const def = objects.find(o => o.id === obj.objectId)
      rects.push({ x: obj.x * svgW, y: obj.y * svgH, w: obj.width * svgW, h: obj.height * svgH, stroke: def?.color || '#666', fill: 'none', label: def?.name || `O${i + 1}` })
    })

    if (panel.signature) {
      const sig = panel.signature
      rects.push({ x: sig.x * svgW, y: sig.y * svgH, w: sig.width * svgW, h: sig.height * svgH, stroke: '#8e44ad', fill: 'none', dash: '4 3', label: 'firma' })
    }
  } else {
    if (panel.narration && panel.narration.text) {
      const n = panel.narration
      rects.push({ x: n.x * svgW, y: n.y * svgH, w: n.width * svgW, h: n.height * svgH, stroke: '#007aff', fill: 'none', dash: n.framed ? 'none' : '4 3', label: 'narración' })
    }

    const balloons = orderedPanelDialogues(panel, characters || [])
    balloons.forEach(b => {
      rects.push({ x: b.x * svgW, y: b.y * svgH, w: b.width * svgW, h: b.height * svgH, stroke: b.type === 'thought' ? '#7d3cff' : '#e04040', fill: 'rgba(0,0,0,0.03)', dash: '4 3', label: `${b.number}. ${b.label}` })
    })

    ;(panel.globosX || []).forEach((g, i) => {
      if (!g.text) return
      const stroke = g.channel === 'thought' ? '#7d3cff' : g.channel === 'whisper' ? '#e67e22' : g.channel === 'shout' ? '#8e44ad' : '#16a085'
      rects.push({ x: g.x * svgW, y: g.y * svgH, w: g.width * svgW, h: g.height * svgH, stroke, fill: 'rgba(0,0,0,0.03)', dash: '4 3', label: `X${i + 1}` })
    })

    ;(panel.sfx || []).forEach((s) => {
      if (s.text) rects.push({ x: s.x * svgW, y: s.y * svgH, w: s.width * svgW, h: s.height * svgH, stroke: '#e67e22', fill: 'none', label: s.text })
    })
  }

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgW} ${svgH}" width="${svgW}" height="${svgH}">`
  svg += `<rect x="0" y="0" width="${svgW}" height="${svgH}" fill="white" stroke="#000" stroke-width="1"/>`

  rects.forEach(r => {
    const dash = r.dash ? ` stroke-dasharray="${r.dash}"` : ''
    svg += `<rect x="${Math.round(r.x)}" y="${Math.round(r.y)}" width="${Math.round(r.w)}" height="${Math.round(r.h)}" fill="${r.fill}" stroke="${r.stroke}" stroke-width="1.5"${dash}/>`
    const labelX = Math.round(r.x + r.w / 2)
    const labelY = Math.round(r.y + r.h / 2)
    svg += `<text x="${labelX}" y="${labelY}" text-anchor="middle" dominant-baseline="central" font-family="monospace" font-size="10" fill="${r.stroke}">${r.label}</text>`
  })

  if (mode === 'lettering') {
    const balloons = orderedPanelDialogues(panel, characters || [])
    const byInstance = {}
    balloons.forEach(b => { (byInstance[b.name] = byInstance[b.name] || []).push(b) })

    const lineEl = (x1, y1, x2, y2, dash) => {
      const d = dash ? ` stroke-dasharray="${dash}"` : ''
      return `<line x1="${Math.round(x1)}" y1="${Math.round(y1)}" x2="${Math.round(x2)}" y2="${Math.round(y2)}" stroke="#c0392b" stroke-width="0.5"${d}/>`
    }

    Object.values(byInstance).forEach(list => {
      for (let i = 0; i < list.length - 1; i++) {
        const a = list[i]
        const b = list[i + 1]
        const x1 = (a.x + a.width / 2) * svgW
        const y1 = (a.y + a.height / 2) * svgH
        const x2 = (b.x + b.width / 2) * svgW
        const y2 = (b.y + b.height / 2) * svgH
        svg += lineEl(x1, y1, x2, y2, '3 3')
      }
    })
    Object.values(byInstance).forEach(list => {
      const last = list[list.length - 1]
      const ch = (panel.characters || [])[last.charIdx]
      if (!ch) return
      const bx = (last.x + last.width / 2) * svgW
      const by = (last.y + last.height / 2) * svgH
      const cx = (ch.x + ch.width / 2) * svgW
      const cy = (ch.y + ch.height * 0.3) * svgH
      svg += lineEl(bx, by, cx, cy)
    })
    ;(panel.globosX || []).forEach(g => {
      if (!g.text) return
      const target = anchorTarget(g, panel, characters, objects, svgW, svgH)
      if (!target) return
      const bx = (g.x + g.width / 2) * svgW
      const by = (g.y + g.height / 2) * svgH
      svg += lineEl(bx, by, target.x, target.y)
    })
  }

  svg += '</svg>'
  return svg
}
