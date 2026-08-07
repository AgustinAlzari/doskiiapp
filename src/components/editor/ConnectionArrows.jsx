export default function ConnectionArrows({ connections, panelCharacters, characters, objects, backgrounds, getPortScreenPos, getObjectPortScreenPos, getBackgroundPortScreenPos }) {
  if (!connections || connections.length === 0) return null

  const arrows = connections
    .map(conn => {
      const fromDef = characters.find(c => c.id === conn.from)
      const toType = conn.toType || 'character'
      const toDef = toType === 'object'
        ? objects.find(o => o.id === conn.to)
        : toType === 'background'
          ? backgrounds.find(bg => bg.id === conn.to)
          : characters.find(c => c.id === conn.to)
      if (!fromDef || !toDef) return null

      const fromPos = getPortScreenPos(conn.from, 'out')
      const toPos = toType === 'object'
        ? getObjectPortScreenPos(conn.to)
        : toType === 'background'
          ? getBackgroundPortScreenPos()
          : getPortScreenPos(conn.to, 'in')
      if (!fromPos || !toPos) return null

      return {
        id: `${conn.from}-${conn.to}`,
        x1: fromPos.x * 100,
        y1: fromPos.y * 100,
        x2: toPos.x * 100,
        y2: toPos.y * 100,
        fromColor: fromDef.color || '#6a994e',
        toColor: toDef.color || '#bc4749',
        fromName: fromDef.name,
        toName: toDef.name,
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
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      <defs>
        <marker
          id="conn-arrowhead"
          markerWidth="5"
          markerHeight="4"
          refX="4.4"
          refY="2"
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <polygon points="0 0, 5 2, 0 4" fill="#777" />
        </marker>
      </defs>

      {arrows.map(arrow => {
        const dx = arrow.x2 - arrow.x1
        const dy = arrow.y2 - arrow.y1
        const len = Math.sqrt(dx * dx + dy * dy)
        if (len < 1) return null

        const pathD = `M ${arrow.x1} ${arrow.y1} L ${arrow.x2} ${arrow.y2}`

        return (
          <g key={arrow.id}>
            <path
              d={pathD}
              stroke="#777"
              strokeWidth="1.5"
              fill="none"
              strokeDasharray="4 3"
              vectorEffect="non-scaling-stroke"
              markerEnd="url(#conn-arrowhead)"
            />
          </g>
        )
      })}
    </svg>
  )
}
