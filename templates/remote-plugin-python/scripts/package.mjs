import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const outDir = resolve(root, 'package', '{{pluginName}}')

function copy(source, target) {
  cpSync(resolve(root, source), resolve(outDir, target), { recursive: true })
}

if (!existsSync(resolve(root, 'frontend/dist/index.html'))) {
  console.error('Missing frontend/dist/index.html. Run npm run build first.')
  process.exit(1)
}

rmSync(outDir, { recursive: true, force: true })
mkdirSync(outDir, { recursive: true })

copy('frontend/dist', 'frontend/dist')
copy('backend', 'backend')
copy('d3plugin.json', 'd3plugin.json')
copy('remote-plugin.config.json', 'remote-plugin.config.json')
copy('README.md', 'README.md')

writeFileSync(
  resolve(outDir, 'install-deps.bat'),
  '@echo off\r\npython -m pip install -r backend\\requirements.txt\r\n',
  'utf8'
)

writeFileSync(
  resolve(outDir, 'run.bat'),
  '@echo off\r\npython backend\\app.py --publish --static frontend\\dist\r\n',
  'utf8'
)

console.log(`Packaged remote plugin -> ${outDir}`)

