import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { checkText, addWord } from '../services/spellcheck'

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function cloneTextareaStyles(el) {
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

export function SpellPopover({ word, suggestions, x, y, onApply, onIgnore, onClose }) {
  useEffect(() => {
    const onDown = (e) => {
      if (e.target.closest?.('.spell-popover')) return
      onClose()
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [onClose])

  const popX = Math.min(x, window.innerWidth - 200)
  const popY = Math.min(y, window.innerHeight - 160)

  return (
    <div
      className="spell-popover"
      style={{
        position: 'fixed',
        left: popX,
        top: popY,
        zIndex: 20002,
        minWidth: 180,
        maxWidth: 240,
        background: 'var(--color-bg)',
        border: '1px solid var(--color-border)',
        borderRadius: 8,
        boxShadow: '0 8px 24px rgba(0,0,0,0.14)',
        padding: 10,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', lineHeight: 1.3 }}>
        «{word}»
      </div>
      {suggestions.length > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {suggestions.map(s => (
            <button
              key={s}
              className="btn btn-sm"
              style={{ fontSize: 11, padding: '2px 8px', height: 'auto' }}
              onClick={() => onApply(s)}
            >
              {s}
            </button>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
          sin sugerencias
        </div>
      )}
      <button
        className="btn btn-ghost btn-sm"
        style={{ fontSize: 11, alignSelf: 'flex-start', height: 'auto', padding: '2px 8px' }}
        onClick={() => onIgnore(word)}
      >
        agregar al diccionario
      </button>
    </div>
  )
}

export default function SpellCheckedTextarea({ value, onChange, placeholder, minRows = 3, maxRows = 20, className = 'input textarea', style = {}, ...rest }) {
  const ref = useRef(null)
  const wrapRef = useRef(null)
  const [issues, setIssues] = useState([])
  const [popover, setPopover] = useState(null)
  const [backdropStyle, setBackdropStyle] = useState({})
  const [checking, setChecking] = useState(false)

  const adjustHeight = () => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    const lineHeight = parseInt(getComputedStyle(el).lineHeight) || 20
    const minH = minRows * lineHeight
    const maxH = maxRows * lineHeight
    el.style.height = Math.min(Math.max(el.scrollHeight, minH), maxH) + 'px'
  }

  useLayoutEffect(() => {
    adjustHeight()
    setBackdropStyle(cloneTextareaStyles(ref.current))
  }, [value, className])

  useEffect(() => {
    let active = true
    const t = setTimeout(async () => {
      if (!String(value || '').trim()) { setIssues([]); return }
      setChecking(true)
      try {
        const res = await checkText(value)
        if (active) setIssues(res)
      } catch (e) {
        console.error('spellcheck:', e)
        if (active) setIssues([])
      } finally {
        if (active) setChecking(false)
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
    if (iss) {
      setPopover({ ...iss, x: e.clientX, y: e.clientY + 10 })
    } else {
      setPopover(null)
    }
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
    const res = await checkText(value)
    setIssues(res)
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
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
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          overflowWrap: 'break-word',
          color: 'var(--color-text)',
          pointerEvents: 'none',
          ...backdropStyle,
        }}
        dangerouslySetInnerHTML={{ __html: highlighted || ' ' }}
      />
      <textarea
        ref={ref}
        className={className}
        value={value}
        onChange={onChange}
        onMouseUp={handlePointer}
        onKeyUp={(e) => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') handlePointer(e) }}
        placeholder={placeholder}
        rows={minRows}
        style={{
          position: 'relative',
          overflow: 'hidden',
          resize: 'none',
          background: 'transparent',
          color: 'transparent',
          caretColor: 'var(--color-text)',
          ...style,
        }}
        {...rest}
      />
      {checking && String(value || '').trim() ? (
        <span style={{ position: 'absolute', bottom: 4, right: 8, fontSize: 9, color: 'var(--color-text-muted)', pointerEvents: 'none', background: 'var(--color-bg)', padding: '0 3px', borderRadius: 3 }}>
          revisando…
        </span>
      ) : null}
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