export default function GazeArrows({ panel, characters, objects }) {
  if (!panel) return null

  const panelChars = panel.characters || []
  const panelObjects = panel.objects || []

  const arrows = panelChars
    .filter(ch => ch.gazeTarget)
    .map(ch => {
      const sourceDef = characters.find(c => c.id === ch.characterId)
      if (!sourceDef) return null

      let targetX, targetY, targetName
      if (ch.gazeTarget.type === 'character') {
        const target = panelChars.find(c => c.characterId === ch.gazeTarget.id)
        if (!target) return null
        targetX = target.x + target.width / 2
        targetY = target.y + target.height / 2
        const targetDef = characters.find(c => c.id === target.characterId)
        targetName = targetDef?.name || '?'
      } else if (ch.gazeTarget.type === 'object') {
        const target = panelObjects.find(o => o.objectId === ch.gazeTarget.id)
        if (!target) return null
        targetX = target.x + target.width / 2
        targetY = target.y + target.height / 2
        const targetDef = objects.find(o => o.id === target.objectId)
        targetName = targetDef?.name || '?'
      } else if (ch.gazeTarget.type === 'narration') {
        const narr = panel.narration
        if (!narr) return null
        targetX = narr.x + narr.width / 2
        targetY = narr.y + narr.height / 2
        targetName = 'narración'
      } else {
        return null
      }

      const sourceX = ch.x + ch.width / 2
      const sourceY = ch.y + ch.height / 2

      return {
        id: `${ch.characterId}-${ch.gazeTarget.type}-${ch.gazeTarget.id}`,
        x1: sourceX * 100,
        y1: sourceY * 100,
        x2: targetX * 100,
        y2: targetY * 100,
        color: sourceDef.color || '#999',
        label: targetName,
      }
    })
    .filter(Boolean)

  if (arrows.length === 0) return null

  return (
    <svg
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 10,
        overflow: 'visible',
      }}
    >
      <defs>
        <marker
          id="gaze-arrowhead"
          markerWidth="8"
          markerHeight="6"
          refX="7"
          refY="3"
          orient="auto"
        >
          <polygon points="0 0, 8 3, 0 6" fill="currentColor" />
        </marker>
      </defs>

      {arrows.map(arrow => {
        const dx = arrow.x2 - arrow.x1
        const dy = arrow.y2 - arrow.y1
        const len = Math.sqrt(dx * dx + dy * dy)
        if (len < 1) return null

        const midX = (arrow.x1 + arrow.x2) / 2
        const midY = (arrow.y1 + arrow.y2) / 2
        const curveOffset = Math.min(len * 0.15, 5)
        const nx = -dy / len
        const ny = dx / len
        const cx = midX + nx * curveOffset
        const cy = midY + ny * curveOffset

        const pathD = `M ${arrow.x1} ${arrow.y1} Q ${cx} ${cy} ${arrow.x2} ${arrow.y2}`

        const labelX = cx
        const labelY = cy - 6

        return (
          <g key={arrow.id}>
            <path
              d={pathD}
              stroke={arrow.color}
              strokeWidth="2"
              fill="none"
              strokeDasharray="6 3"
              opacity="0.7"
              markerEnd="url(#gaze-arrowhead)"
              style={{ color: arrow.color }}
            />
            <text
              x={labelX}
              y={labelY}
              textAnchor="middle"
              fill={arrow.color}
              fontSize="9"
              fontWeight="500"
              opacity="0.8"
            >
              {arrow.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
