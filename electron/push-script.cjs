const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const TOKEN = process.env.GIT_API_TOKEN
const REPO = process.env.GIT_API_REPO
const BRANCH = process.env.GIT_API_BRANCH || 'main'
const ROOT = process.env.GIT_API_ROOT || process.cwd()

const EXCLUDE_DIRS = new Set(['node_modules', 'dist', 'release', 'data', '.sync-backup', 'docs', '.git'])
const EXCLUDE_FILES = new Set(['.DS_Store'])

const gh = async (url, opts = {}) => {
  const res = await fetch(`https://api.github.com/${url}`, {
    method: opts.method || 'GET',
    headers: {
      Authorization: `token ${TOKEN}`,
      'Content-Type': 'application/json',
      'User-Agent': 'doski-push',
      ...(opts.headers || {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  })
  const text = await res.text()
  const data = text ? JSON.parse(text) : null
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${text.slice(0, 500)}`)
  return data
}

const blobSha = (content) => crypto.createHash('sha1').update(`blob ${Buffer.byteLength(content)}\0${content}`).digest('hex')

function collectFiles(dir, base) {
  const out = {}
  for (const name of fs.readdirSync(dir)) {
    if (EXCLUDE_DIRS.has(name) || EXCLUDE_FILES.has(name)) continue
    const full = path.join(dir, name)
    const rel = path.posix.join(base, name)
    const st = fs.statSync(full)
    if (st.isDirectory()) Object.assign(out, collectFiles(full, rel))
    else out[rel] = full
  }
  return out
}

async function main() {
  const head = await gh(`repos/${REPO}/commits/${BRANCH}`)
  const baseTreeSha = head.commit.tree.sha
  console.log('head:', head.sha)

  const files = collectFiles(ROOT, '')
  console.log('archivos locales (sin data/node_modules/dist/release):', Object.keys(files).length)

  const tree = await gh(`repos/${REPO}/git/trees/${baseTreeSha}?recursive=1`)
  const existing = new Map()
  for (const t of tree.tree || []) {
    if (t.type === 'blob') existing.set(t.path, t.sha)
  }

  const entries = []
  let uploaded = 0
  for (const [rel, full] of Object.entries(files)) {
    const content = fs.readFileSync(full)
    const sha = blobSha(content)
    if (existing.get(rel) === sha) {
      entries.push({ path: rel, mode: '100644', type: 'blob', sha })
      continue
    }
    const blob = await gh(`repos/${REPO}/git/blobs`, {
      method: 'POST',
      body: { content: content.toString('base64'), encoding: 'base64' },
    })
    entries.push({ path: rel, mode: '100644', type: 'blob', sha: blob.sha })
    uploaded++
  }

  const keep = []
  for (const t of tree.tree || []) {
    if (t.type !== 'blob') continue
    if (t.path.startsWith('data/') || t.path.startsWith('docs/')) continue
    if (files[t.path] === undefined && !EXCLUDE_FILES.has(path.basename(t.path))) {
      keep.push({ path: t.path, mode: t.mode, type: 'blob', sha: t.sha })
    }
  }
  entries.push(...keep)

  console.log('blobs subidos (nuevos/cambiados):', uploaded)

  const newTree = await gh(`repos/${REPO}/git/trees`, {
    method: 'POST',
    body: { base_tree: baseTreeSha, tree: entries },
  })

  const commit = await gh(`repos/${REPO}/git/commits`, {
    method: 'POST',
    body: {
      message: process.argv[2] || 'update',
      tree: newTree.sha,
      parents: [head.sha],
    },
  })

  await gh(`repos/${REPO}/git/refs/heads/${BRANCH}`, {
    method: 'PATCH',
    body: { sha: commit.sha, force: false },
  })

  console.log('DONE commit:', commit.sha)
  console.log('ver:', `https://github.com/${REPO}/commit/${commit.sha}`)
}

main().catch((e) => { console.error('ERROR:', e.message); process.exit(1) })
