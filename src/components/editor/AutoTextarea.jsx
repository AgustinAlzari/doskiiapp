import { useRef, useEffect } from 'react'

export default function AutoTextarea({ value, onChange, placeholder, minRows = 3, maxRows = 20, className = 'input textarea', style = {}, ...rest }) {
  const ref = useRef(null)

  const adjustHeight = () => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    const lineHeight = parseInt(getComputedStyle(el).lineHeight) || 20
    const minH = minRows * lineHeight
    const maxH = maxRows * lineHeight
    el.style.height = Math.min(Math.max(el.scrollHeight, minH), maxH) + 'px'
  }

  useEffect(() => {
    adjustHeight()
  }, [value])

  return (
    <textarea
      ref={ref}
      className={className}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      rows={minRows}
      style={{ overflow: 'hidden', resize: 'none', ...style }}
      {...rest}
    />
  )
}
