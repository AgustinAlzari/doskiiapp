import { useEffect, useState } from 'react'
import useAuthorStore from '../../store/authorStore'
import useProjectStore from '../../store/projectStore'

function SignatureThumb({ signatureImage }) {
  const [preview, setPreview] = useState(null)
  const ref = signatureImage?.[0]

  useEffect(() => {
    let active = true
    if (ref?.path && window.api?.references) {
      window.api.references.read(ref.path).then(url => { if (active) setPreview(url) })
    } else setPreview(null)
    return () => { active = false }
  }, [ref?.path])

  if (preview) return <img src={preview} alt="" className="entity-card-thumb" />
  return <div className="entity-card-thumb entity-card-thumb-empty" />
}

export default function AuthorList({ onNew, onEdit }) {
  const authors = useAuthorStore(s => s.authors)
  const loaded = useAuthorStore(s => s.loaded)
  const remove = useAuthorStore(s => s.remove)
  const projects = useProjectStore(s => s.projects)

  if (!loaded) return <div style={{ color: 'var(--color-text-muted)', padding: 24 }}>cargando...</div>

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 className="ui-h1">autores</h1>
        <button className="btn btn-primary" onClick={onNew}>nuevo autor</button>
      </div>

      {authors.length === 0 ? (
        <div style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
          sin autores aún. crea uno para firmar tus historietas.
        </div>
      ) : (
        <div className="entity-grid">
          {authors.map(author => {
            const authorProjects = projects.filter(p => p.authorId === author.id)
            return (
              <div
                key={author.id}
                className="entity-card"
                onClick={() => onEdit(author)}
              >
                <SignatureThumb signatureImage={author.signatureImage} />
                <div className="ui-h3">
                  {author.fullName}
                </div>
                {author.signatureText && (
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    «{author.signatureText}»
                  </div>
                )}
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
                  {authorProjects.length > 0
                    ? `${authorProjects.length} ${authorProjects.length === 1 ? 'proyecto' : 'proyectos'}: ${authorProjects.map(p => p.name).join(', ')}`
                    : 'sin proyectos asignados'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: 4 }}>
                  <span />
                  <button
                    className="btn btn-ghost btn-sm btn-danger"
                    onClick={(e) => { e.stopPropagation(); if (confirm(`¿Eliminar a "${author.fullName}"?`)) remove(author.id) }}
                  >
                    ×
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
