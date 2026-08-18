// Sombrea el resto del formulario hasta que se coloque el nombre.
export default function FormShade({ active, hint, children }) {
  const hidden = !active
  return (
    <fieldset
      disabled={hidden}
      style={{
        border: 'none',
        padding: 0,
        margin: 0,
        minWidth: 0,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
        opacity: hidden ? 0.4 : 1,
        filter: hidden ? 'grayscale(0.7)' : 'none',
        pointerEvents: hidden ? 'none' : 'auto',
        userSelect: hidden ? 'none' : 'auto',
        transition: 'opacity 0.15s ease',
      }}
    >
      {hidden && hint && (
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{hint}</div>
      )}
      {children}
    </fieldset>
  )
}