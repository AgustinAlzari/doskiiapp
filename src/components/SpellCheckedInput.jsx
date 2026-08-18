import { useEffect, useMemo, useRef, useState } from 'react'
import { checkText, addWord } from '../services/spellcheck'
import { SpellPopover } from './SpellCheckedTextarea'

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function cloneInputStyles(el) {
  if (!el) return {}
  const cs = getComputedStyle(el)
  return {
    fontFamily: cs.fontFamily,
    fontSize: cs.fontSize,
    fontWeight: cs.fontWeight,
    lineHeight: cs.lineHeight,
    letterSpacing: cs.letterSpacing,
    textAlign: cs.textAlign,
    paddingTop: cs.paddingTop,
    paddingRight: cs.paddingRight,
    paddingBottom: cs.paddingBottom,
    paddingLeft: cs.paddingLeft,
    borderTopWidth: cs.borderTopWidth,
    borderRightWidth: cs.borderRightWidth,
    borderBottomWidth: cs.borderBottomWidth,
    borderLeftWidth: cs.borderLeftWidth,
    boxSizing: cs.boxSizing,
  }
}

export default function SpellCheckedInput({ value, onChange, className = 'input', style = {}, ...rest }) {
  const ref = useRef(null)
  const [issues, setIssues] = useState([])
  const [popover, setPopover] = useState(null)
  const [backdropStyle, setBackdropStyle] = useState({})

  useEffect(() => {
    setBackdropStyle(cloneInputStyles(ref.current))
  }, [])

  useEffect(() => {
    let active = true
    const t = setTimeout(async () => {
      if (!String(value || '').trim()) { setIssues([]); return }
      try {
        const res = await checkText(value)
        if (active) setIssues(res)
      } catch {
        if (active) setIssues([])
      }
    }, 250)
    return () => { active = false; clearTimeout(t) }
  }, [value])

  const highlighted = useMemo(() => {
    const str = String(value || '')
    if (!issues.length) return escapeHtml(str)
    let out = ''
    let last = 0
    for (const iss of issues) {
      out += escapeHtml(str.slice(last, iss.index))
      out += `<mark class="spell-mark">${escapeHtml(str.slice(iss.index, iss.index + iss.length))}</mark>`
      last = iss.index + iss.length
    }
    out += escapeHtml(str.slice(last))
    return out
  }, [value, issues])

  const handlePointer = (e) => {
    const el = ref.current
    if (!el) return
    const pos = el.selectionStart
    const iss = issues.find(i => pos >= i.index && pos <= i.index + i.length)
    if (iss) setPopover({ ...iss, x: e.clientX, y: e.clientY + 12 })
    else setPopover(null)
  }

  const apply = (correction) => {
    const p = popover
    if (!p) return
    onChange({ target: { value: String(value || '').slice(0, p.index) + correction + String(value || '').slice(p.index + p.length) } })
    setPopover(null)
  }

  const ignore = async (word) => {
    addWord(word)
    setPopover(null)
    setIssues(await checkText(value))
  }

  return (
    <div style={{ position: 'relative' }}>
      <div
        className="spell-backdrop"
        aria-hidden
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          overflow: 'hidden',
          whiteSpace: 'pre',
          color: 'var(--color-text)',
          pointerEvents: 'none',
          ...backdropStyle,
        }}
        dangerouslySetInnerHTML={{ __html: highlighted || ' ' }}
      />
      <input
        ref={ref}
        className={className}
        value={value}
        onChange={onChange}
        onMouseUp={handlePointer}
        style={{
          position: 'relative',
          background: 'transparent',
          color: 'transparent',
          caretColor: 'var(--color-text)',
          ...style,
        }}
        {...rest}
      />
      {popover && (
        <SpellPopover
          word={popover.word}
          suggestions={popover.suggestions}
          x={popover.x}
          y={popover.y}
          onApply={apply}
          onIgnore={ignore}
          onClose={() => setPopover(null)}
        />
      )}
    </div>
  )
}