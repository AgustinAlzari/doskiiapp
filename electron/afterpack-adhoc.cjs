// afterpack-adhoc.cjs — firma ad-hoc los .app de mac tras empaquetar.
//
// Sin certificado Apple (identity: null) el sello de Electron queda roto al
// modificar el bundle y macOS dice "dañado" sin permitir abrir ni con
// clic derecho. La firma ad-hoc deja el sello válido: Gatekeeper sigue
// pidiendo confirmación (app sin firmar) pero el flujo "clic derecho → abrir"
// funciona, que es lo que indica la web.
const { execFileSync } = require('child_process')
const fs = require('fs')
const path = require('path')

exports.default = async function (context) {
  if (context.electronPlatformName !== 'darwin') return
  const apps = fs.readdirSync(context.appOutDir).filter((f) => f.endsWith('.app'))
  for (const app of apps) {
    const appPath = path.join(context.appOutDir, app)
    console.log(`[afterPack] firma ad-hoc: ${appPath}`)
    execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], { stdio: 'inherit' })
    execFileSync('codesign', ['--verify', '--deep', '--strict', appPath], { stdio: 'inherit' })
  }
}
