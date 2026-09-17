const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const TOKEN_FILE = `${process.env.HOME}/.config/doski/gh-token`
let TOKEN = ''
try { TOKEN = fs.readFileSync(TOKEN_FILE, 'utf8').trim() } catch {}
const REPO = process.env.GIT_API_REPO || 'AgustinAlzari/doskiiapp'
const BRANCH = process.env.GIT_API_BRANCH || 'main'
const ROOT = process.env.GIT_API_ROOT || process.cwd()

// For pull we exclude only build artifacts, not data/docs necessarily.
// But by default for CODE pull we exclude data, node_modules, dist, release, .sync-backup, .git
// If PULL_INCLUDE_DATA=1 we include data
const INCLUDE_DATA = process.env.PULL_INCLUDE_DATA === '1'
const EXCLUDE_DIRS = new Set(INCLUDE_DATA ? ['node_modules','dist','release','.sync-backup','.git'] : ['node_modules','dist','release','data','.sync-backup','docs','.git'])
const EXCLUDE_FILES = new Set(['.DS_Store'])

const gh = async (url, opts={}) => {
  const res = await fetch(`https://api.github.com/${url}`, {
    method: opts.method || 'GET',
    headers: {
      Authorization: `token ${TOKEN}`,
      'Content-Type': 'application/json',
      'User-Agent': 'doski-pull',
      ...(opts.headers||{}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  })
  const text = await res.text()
  const data = text ? JSON.parse(text) : null
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${text.slice(0,1000)}`)
  return data
}

const blobSha = (content) => {
  const h = crypto.createHash('sha1')
  h.update(`blob ${content.length}\0`)
  h.update(content)
  return h.digest('hex')
}

function collectLocalFiles(dir, base, out) {
  if (!fs.existsSync(dir)) return
  for (const name of fs.readdirSync(dir)) {
    if (EXCLUDE_FILES.has(name)) continue
    // EXCLUDE_DIRS solo a nivel raíz (top-level) para no excluir src/data
    if (base === '' && EXCLUDE_DIRS.has(name)) continue
    const full = path.join(dir, name)
    const rel = path.posix.join(base, name)
    const st = fs.statSync(full)
    if (st.isDirectory()) collectLocalFiles(full, rel, out)
    else out[rel] = full
  }
}

async function fetchBlobContent(sha) {
  // try blob API with raw accept then fallback to base64 json
  const res = await fetch(`https://api.github.com/repos/${REPO}/git/blobs/${sha}`, {
    headers: { Authorization: `token ${TOKEN}`, 'User-Agent':'doski-pull', Accept: 'application/vnd.github.v3.raw' }
  })
  if (res.ok) {
    const buf = Buffer.from(await res.arrayBuffer())
    // if server returned JSON instead of raw, detect
    const ct = res.headers.get('content-type') || ''
    if (ct.includes('json')) {
      const j = JSON.parse(buf.toString('utf8'))
      if (j.content) return Buffer.from(j.content, 'base64')
      return buf
    }
    return buf
  }
  // fallback to json base64
  const j = await gh(`repos/${REPO}/git/blobs/${sha}`)
  return Buffer.from(j.content, 'base64')
}

async function fetchRawContent(rel) {
  // fallback using raw.githubusercontent (public)
  const url = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${rel}`
  const res = await fetch(url, { headers: TOKEN ? { Authorization: `token ${TOKEN}`, 'User-Agent':'doski-pull'}:{} })
  if (!res.ok) throw new Error(`raw fetch ${rel}: ${res.status} ${res.statusText}`)
  return Buffer.from(await res.arrayBuffer())
}

async function main(){
  console.log(`ROOT: ${ROOT}`)
  console.log(`REPO: ${REPO}@${BRANCH} include_data=${INCLUDE_DATA}`)
  const head = await gh(`repos/${REPO}/commits/${BRANCH}`)
  const baseTreeSha = head.commit.tree.sha
  console.log('remote head:', head.sha, head.commit.message.split('\n')[0], head.commit.author.date)
  console.log('tree:', baseTreeSha)
  const treeData = await gh(`repos/${REPO}/git/trees/${baseTreeSha}?recursive=1`)
  if (treeData.truncated) console.warn('WARN tree truncated')
  const remoteMap = new Map() // path -> sha
  for (const t of treeData.tree) {
    if (t.type !== 'blob') continue
    // apply exclude filter for remote
    const top = t.path.split('/')[0]
    if (EXCLUDE_DIRS.has(top)) continue
    if (EXCLUDE_FILES.has(path.basename(t.path))) continue
    remoteMap.set(t.path, t.sha)
  }
  console.log('remote code blobs (filtered):', remoteMap.size)

  const localFiles = {}
  collectLocalFiles(ROOT, '', localFiles)
  console.log('local code files (filtered):', Object.keys(localFiles).length)

  let updated=0, added=0, unchanged=0, errors=0
  for (const [rel, sha] of remoteMap.entries()) {
    const localPath = path.join(ROOT, rel)
    let localSha = null
    let needs = false
    if (fs.existsSync(localPath)) {
      try {
        const content = fs.readFileSync(localPath)
        localSha = blobSha(content)
        if (localSha !== sha) needs = true
      } catch(e){ needs=true }
    } else {
      needs = true
    }
    if (!needs) { unchanged++; continue }
    const existed = fs.existsSync(localPath)
    try {
      // Prefer blob API by sha (exact), fallback to raw
      let buf
      try { buf = await fetchBlobContent(sha) }
      catch(e) { console.warn(` blob ${rel} -> raw fallback: ${e.message}`); buf = await fetchRawContent(rel) }
      // verify sha
      const gotSha = blobSha(buf)
      if (gotSha !== sha) console.warn(` sha mismatch ${rel}: expected ${sha} got ${gotSha}`)
      fs.mkdirSync(path.dirname(localPath), {recursive:true})
      fs.writeFileSync(localPath, buf)
      if (existed) updated++; else added++
      console.log(` ${existed?'UPD':'ADD'} ${rel} (${buf.length} bytes)`)
    } catch(e){
      console.error(` ERR ${rel}: ${e.message}`)
      errors++
    }
  }
  // Optionally report local files not in remote
  let extra=0
  for (const rel of Object.keys(localFiles)){
    if (!remoteMap.has(rel)) {
      // if it's a code file that was removed remotely, we keep it but warn
      // Could delete if you want exact mirror - disabled by default
      // console.log(` extra local not in remote: ${rel}`)
      extra++
    }
  }
  console.log(`\nresumen: +${added} nuevos · ${updated} actualizados · ${unchanged} sin cambios · ${extra} locales extra (no borrados) · ${errors} errores`)
  if (INCLUDE_DATA) console.log('nota: data incluida')
  else console.log('nota: data/docs excluidos (usa PULL_INCLUDE_DATA=1 para incluirlos)')
  console.log('DONE pull')
}
main().catch(e=>{console.error('ERROR', e); process.exit(1)})
